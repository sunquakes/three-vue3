import { defineComponent, onBeforeUnmount, onMounted, PropType, watch } from 'vue'
import * as THREE from 'three'
import { useScene } from '../context/SceneContext'
import { getSceneGeo } from '../crs/SceneGeo'
import { flattenGeoJson } from '../crs/GeoJson'
import type { GeoJsonData, GeoJsonFeature, GeoJsonRingSet } from '../crs/GeoJson'
import type { DatumType } from '../crs/types'
import type { GeoReference } from '../crs/GeoReference'

export interface GeoJsonStyle {
  /** Fill color for polygons; set to null/transparent to render edges only. */
  fillColor?: THREE.ColorRepresentation
  /** Edge color for polygons and color of line strings. */
  strokeColor?: THREE.ColorRepresentation
  /** Marker color for points. */
  pointColor?: THREE.ColorRepresentation
  /** Point marker size in world metres (diamond billboard via LineSegments). */
  pointSize?: number
  /** Polygon extrusion height in metres; 0 renders a flat ground overlay. */
  extrudeHeight?: number
  opacity?: number
}

export interface GeoJsonLayerProps {
  data: GeoJsonData
  datum?: DatumType
  style?: GeoJsonStyle
  /** Per-feature style override; return null to skip the feature, undefined to keep the base style. */
  featureStyle?: (feature: GeoJsonFeature) => GeoJsonStyle | null | undefined
  onReady?: (group: THREE.Group) => void
  scene?: THREE.Scene
}

const DEFAULT_STYLE: Required<Omit<GeoJsonStyle, 'extrudeHeight'>> & {
  extrudeHeight: number
} = {
  fillColor: 0x4a90d9,
  strokeColor: 0x9fd0ff,
  pointColor: 0xffd166,
  pointSize: 20,
  extrudeHeight: 0,
  opacity: 0.85
}

function resolveStyle(
  base: GeoJsonStyle | undefined,
  override?: GeoJsonStyle | null
): GeoJsonStyle {
  return { ...DEFAULT_STYLE, ...(base ?? {}), ...(override ?? {}) }
}

function colorOf(value: THREE.ColorRepresentation): THREE.Color {
  return new THREE.Color(value)
}

/** Rotate a planar ENU polygon shape onto the ground plane (extrusion along +Y). */
function buildPolygonMesh(
  rings: GeoJsonRingSet,
  geo: GeoReference,
  datum: DatumType,
  style: GeoJsonStyle
): THREE.Mesh {
  const shape = new THREE.Shape()
  rings.outer.forEach((point, index) => {
    const local = geo.toLocal(point, datum)
    if (index === 0) shape.moveTo(local.x, -local.z)
    else shape.lineTo(local.x, -local.z)
  })

  const holes = rings.holes.map((ring) => {
    const path = new THREE.Path()
    ring.forEach((point, index) => {
      const local = geo.toLocal(point, datum)
      if (index === 0) path.moveTo(local.x, -local.z)
      else path.lineTo(local.x, -local.z)
    })
    return path
  })
  shape.holes.push(...holes)

  const height = style.extrudeHeight ?? 0
  const geometry =
    height > 0
      ? new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false })
      : new THREE.ShapeGeometry(shape)
  geometry.rotateX(-Math.PI / 2)

  const material = new THREE.MeshBasicMaterial({
    color: colorOf(style.fillColor ?? DEFAULT_STYLE.fillColor),
    transparent: (style.opacity ?? 1) < 1,
    opacity: style.opacity ?? 1,
    side: THREE.DoubleSide
  })
  return new THREE.Mesh(geometry, material)
}

export default defineComponent({
  name: 'TvGeoJsonLayer',
  props: {
    data: {
      type: Object as PropType<GeoJsonData>,
      required: true
    },
    datum: {
      type: String as PropType<DatumType>
    },
    style: {
      type: Object as PropType<GeoJsonStyle>
    },
    /** Per-feature style override; return null to skip the feature. */
    featureStyle: {
      type: Function as PropType<
        (feature: GeoJsonFeature) => GeoJsonStyle | null | undefined
      >
    },
    onReady: {
      type: Function as PropType<(group: THREE.Group) => void>
    },
    scene: {
      type: Object as PropType<THREE.Scene>
    }
  },
  setup(props) {
    const sceneContext = useScene()

    let group: THREE.Group | null = null
    let retryTimer = 0
    let disposed = false

    function destroy() {
      disposed = true
      window.clearTimeout(retryTimer)
      if (group) {
        group.removeFromParent()
        group.traverse((child) => {
          const obj = child as THREE.LineSegments | THREE.Mesh
          obj.geometry?.dispose()
          const material = (obj as THREE.Mesh).material as THREE.Material | undefined
          material?.dispose()
        })
        group = null
      }
    }

    function create() {
      destroy()
      disposed = false

      const init = () => {
        if (disposed) return
        const scene = props.scene || sceneContext.scene
        const geo = (scene ? getSceneGeo(scene) : undefined) ?? sceneContext.geo
        const effectiveDatum = props.datum ?? geo?.datum
        if (!scene || !geo || !effectiveDatum) {
          // The Scene context is published asynchronously after the renderer
          // starts; retry briefly until both the scene and its geo exist.
          retryTimer = window.setTimeout(init, 100)
          return
        }

        const layerGroup = new THREE.Group()
        layerGroup.name = 'GeoJsonLayer'

        const flat = flattenGeoJson(props.data)
        const merged = resolveStyle(props.style)

        // Points: a single LineSegments draw call renders diamond billboards whose
        // pixel size stays constant regardless of distance.
        if (flat.points.length > 0) {
          const positions: number[] = []
          flat.points.forEach((point) => {
            const local = geo.toLocal(point, effectiveDatum)
            const half = (merged.pointSize ?? DEFAULT_STYLE.pointSize) / 2
            positions.push(
              local.x - half,
              local.y,
              local.z,
              local.x + half,
              local.y,
              local.z,
              local.x,
              local.y - half,
              local.z,
              local.x,
              local.y + half,
              local.z
            )
          })
          const geometry = new THREE.BufferGeometry()
          geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
          const material = new THREE.LineBasicMaterial({
            color: colorOf(merged.pointColor ?? DEFAULT_STYLE.pointColor)
          })
          layerGroup.add(new THREE.LineSegments(geometry, material))
        }

        // Lines: separate segments per ring so unrelated rings never connect.
        const linePositions: number[] = []
        flat.lines.forEach((ring) => {
          for (let i = 0; i < ring.length - 1; i++) {
            const a = geo.toLocal(ring[i], effectiveDatum)
            const b = geo.toLocal(ring[i + 1], effectiveDatum)
            linePositions.push(a.x, a.y, a.z, b.x, b.y, b.z)
          }
        })
        if (linePositions.length > 0) {
          const geometry = new THREE.BufferGeometry()
          geometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3))
          const material = new THREE.LineBasicMaterial({
            color: colorOf(merged.strokeColor ?? DEFAULT_STYLE.strokeColor)
          })
          layerGroup.add(new THREE.LineSegments(geometry, material))
        }

        // Polygons: per-feature geometry so property-driven fill colors and
        // extrusion heights stay possible. Features are flattened individually to
        // preserve the feature -> style mapping.
        const features =
          props.data.type === 'FeatureCollection'
            ? props.data.features
            : props.data.type === 'Feature'
              ? [props.data]
              : null
        const featureGeometries: { rings: GeoJsonRingSet; override?: GeoJsonStyle | null }[] = []
        if (features) {
          features.forEach((feature) => {
            if (!feature.geometry) return
            const override = props.featureStyle?.(feature)
            if (override === null) return
            const perFeature = flattenGeoJson(feature)
            perFeature.polygons.forEach((rings) => featureGeometries.push({ rings, override }))
          })
        } else {
          flat.polygons.forEach((rings) => featureGeometries.push({ rings }))
        }
        featureGeometries.forEach(({ rings, override }) => {
          const polygonStyle = resolveStyle(props.style, override)
          layerGroup.add(buildPolygonMesh(rings, geo, effectiveDatum, polygonStyle))

          // A stroked outline makes flat fills readable on dark backgrounds.
          const outline: number[] = []
          const ringList = [rings.outer, ...rings.holes]
          ringList.forEach((ring) => {
            for (let i = 0; i < ring.length; i++) {
              const a = geo.toLocal(ring[i], effectiveDatum)
              const b = geo.toLocal(ring[(i + 1) % ring.length], effectiveDatum)
              outline.push(a.x, a.y + 0.05, a.z, b.x, b.y + 0.05, b.z)
            }
          })
          const outlineGeometry = new THREE.BufferGeometry()
          outlineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(outline, 3))
          const outlineMaterial = new THREE.LineBasicMaterial({
            color: colorOf(polygonStyle.strokeColor ?? DEFAULT_STYLE.strokeColor)
          })
          layerGroup.add(new THREE.LineSegments(outlineGeometry, outlineMaterial))
        })

        scene.add(layerGroup)
        group = layerGroup
        props.onReady?.(layerGroup)
      }

      init()
    }

    onMounted(create)
    onBeforeUnmount(destroy)

    watch(() => props.scene, create)
    watch(() => [props.datum, props.featureStyle], create)
    // Data and style are plain JSON/objects, so deep watching catches in-place
    // edits as well as replacements.
    watch(() => [props.data, props.style], create, { deep: true })
  },
  render() {
    return null
  }
})
