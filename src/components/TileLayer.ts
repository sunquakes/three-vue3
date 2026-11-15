import { defineComponent, onBeforeUnmount, onMounted, PropType, watch } from 'vue'
import * as THREE from 'three'
import { useScene } from '../context/SceneContext'
import { getSceneGeo } from '../crs/SceneGeo'
import { lngLatToTile, selectTiles, tileToCorners, tileUrl } from '../crs/Tiles'
import { TilePyramid, TileState, tileKey } from '../crs/TilePyramid'
import type { GroundRect, TileNodeBase } from '../crs/TilePyramid'
import { MAX_GROUND_RANGE_FACTOR, sampleVisibleGround } from '../utils/GroundSampling'
import type { TileIndex } from '../crs/Tiles'
import type { DatumType, GeoPoint } from '../crs/types'
import type { GeoReference } from '../crs/GeoReference'

export interface TileLayerProps {
  /**
   * URL template of the XYZ tile source. Supports {z}, {x}, {y} and an
   * optional {s} subdomain placeholder, e.g.
   * 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'.
   */
  url: string
  /** Slippy-map zoom level (non-negative integer). */
  zoom: number
  /**
   * Static geographic coverage: the bounding rectangle of the points is
   * filled once with tiles at the given zoom. Ignored when `followCamera` is
   * enabled (the default), which derives coverage from the camera instead.
   */
  points?: GeoPoint[]
  /**
   * Keep the layer centred on the camera: every frame the visible ground
   * rectangle (camera frustum projected onto the ground plane) is tiled, and
   * tiles entering/leaving it are loaded/disposed while the camera moves.
   * Requires a Scene context camera; falls back to `points` when an explicit
   * `scene` without context is supplied. Defaults to true.
   */
  followCamera?: boolean
  /**
   * Datum of the tile imagery (and of `points` in static mode). WGS84 for OSM
   * and most international services, GCJ02 for AMap (Gaode)/Tencent. Defaults
   * to the Scene's configured datum.
   */
  datum?: DatumType
  /**
   * Extra rings of tiles loaded beyond the visible ground rectangle so the map
   * stays covered while panning. Defaults to 1.
   */
  padding?: number
  /** Optional {s} subdomain list for the URL template. Defaults to a/b/c. */
  subdomains?: string[]
  /** Opacity of the tile images. Defaults to 1. */
  opacity?: number
  /** Height in local metres at which the ground quads are laid. Defaults to 0.05. */
  y?: number
  /**
   * Air-perspective fading towards the horizon: scene fog plus a backing
   * ground plane tinted to the background colour, both scaled with camera
   * height. This hides the hard rectangular edge of the tiled area at
   * oblique angles so the map dissolves into the background instead of
   * floating over it. Disable with `fog={false}`. Defaults to true.
   */
  fog?: boolean
  /**
   * Colour of the distance fog and backing ground plane. Defaults to the
   * Scene's solid background colour, falling back to #1a1a2e. Set this to the
   * Scene `bgColor` when the background is an image.
   */
  groundColor?: THREE.ColorRepresentation
  /**
   * Safety cap on simultaneously retained tiles. Camera-following mode keeps
   * the `maxTiles` closest to the camera instead of exceeding it; static
   * `points` mode throws when the selection exceeds it. Defaults to 256.
   */
  maxTiles?: number
  /**
   * Largest OrbitControls polar angle (radians from the positive y-axis)
   * allowed while the layer follows the camera. Caps how far the view can tilt
   * toward the horizon, where planar ground tiles degenerate into stretched
   * ribbons. Only applied when context controls exist; a stricter existing
   * limit is never loosened and the original value is restored on unmount.
   * Defaults to 15 degrees above horizontal (PI/2 - 15deg).
   */
  maxPolarAngle?: number
  /** Called once with the layer group after it was added to the scene. */
  onReady?: (group: THREE.Group) => void
  /** Called when one tile image fails to download; the tile stays hidden. */
  onTileError?: (index: TileIndex, url: string) => void
  /** Optional explicit scene; defaults to the Scene provided by context. */
  scene?: THREE.Scene
}

const DEFAULT_OPACITY = 1
const DEFAULT_Y = 0.05
const DEFAULT_MAX_TILES = 256
const DEFAULT_PADDING = 1
// The tiled ground range - and with it the fog extent and the dynamic
// far-plane fit - is scaled in camera heights: imagery is provided up to
// FOG_FAR_FACTOR heights of ground range from the point below the camera, and
// the fog is fully opaque exactly at that coverage edge (see applyAtmosphere).
// The backing plane fills the rest of the view through the fog at any oblique
// angle.
const FOG_FAR_FACTOR = MAX_GROUND_RANGE_FACTOR
const BACKING_HALF_SIZE_FACTOR = 40
const DEFAULT_GROUND_COLOR = 0x1a1a2e
// MapLibre caps its camera pitch at 60 degrees from the vertical: on a flat
// (non-globe) map, tilting further means the tiled coverage and its fog can
// no longer stay ahead of the visible horizon, and planar ground quads
// stretch into blurred ribbons. While the layer follows the camera,
// OrbitControls is therefore constrained to the same polar-angle ceiling; a
// stricter existing limit is kept and the original value is restored on
// unmount.
const DEFAULT_MAX_POLAR_ANGLE = THREE.MathUtils.degToRad(60)
// Closest camera-to-target distance the layer allows while following the
// camera, as a fraction of the zoom-out cap: the camera can never dolly into
// ground-level content (markers, pins) or inside the imagery it looks at.
// Cesium exposes the same idea as minimumZoomDistance.
const MIN_DISTANCE_FACTOR = 0.05
// Screen-space error, in CSS pixels, at which a tile is subdivided into its
// children. 256 means each 256-px tile is refined once it projects larger
// than a full screen tile - the same target used by Cesium/MapLibre. A larger
// value trades imagery sharpness for fewer requests.
const SSE_THRESHOLD_PX = 256
// Hard ceiling on ideal (camera-facing) nodes one cover traversal may reach,
// guarding against an accidental massive selection at extreme parameters.
// Static `points` mode is bounded by its own leaf count instead.
const MAX_IDEAL_NODES = 6000
// Number of concurrent image downloads shared by the whole layer. Public tile
// servers rate-limit bulk requests (OSM famously answers bursts with
// timeouts), so the layer stays within the browser's ~6 connections per host
// instead of overwhelming it.
const MAX_CONCURRENT_LOADS = 6
// Hard ceiling on one tile download. A wedged request otherwise blocks its
// node for the browser's full TCP timeout (~20 s) with no retry, which reads
// as "tiles never load"; on timeout the node fails fast into the retry queue.
const TILE_LOAD_TIMEOUT_MS = 8000
// Failed downloads are retried up to this many extra times, then the node
// stays idle and onTileError fires for every failed attempt.
const MAX_LOAD_ATTEMPTS = 2
// During a continuous gesture the camera crosses the retile threshold on
// nearly every frame. Recomputing the cover that often churns the load queue,
// so traversals are coalesced to at most one per this many milliseconds, with
// a trailing traversal once the gesture settles.
const FILL_THROTTLE_MS = 120
// Re-tile whenever the camera has rotated by at least this many radians even
// without translating, e.g. an orbit tilt whose arc stays inside the
// movement threshold. A stale mid-gesture selection must never be left frozen
// at the final (nearly horizontal) viewing angle.
const MAX_ORIENTATION_DELTA = THREE.MathUtils.degToRad(4)
// Cached tiles are evicted, least-recently-seen first, once the cache holds
// this multiple of maxTiles tiles. Only idle, non-queued nodes are evicted,
// so the visible layer and every pending download are always protected.
const CACHE_FACTOR = 2
// Each tile quad is expanded by this fraction of its span so neighbouring
// quads physically overlap. The overlap strip samples just outside the tile
// image, where ClampToEdge repeats the border pixels, so both neighbours paint
// the same ground content across the seam: sub-pixel gaps between separate
// draw calls can never reveal the background between tiles.
const TILE_OVERLAP_RATIO = 0.01
// Newly arrived imagery crossfades in over whatever is beneath it - its
// on-screen coarse parent during a level swap, the backing plane on a cold
// start - with roughly the same 300 ms ease MapLibre gives raster tiles,
// instead of popping in frame-hard. The parent stays rendered as an underlay
// until the fade completes; painter order (creation order, coarse first)
// draws the fading child on top of it. Cached re-appearances show instantly.
const FADE_DURATION_MS = 300

interface TileLayerNode extends TileNodeBase {
  mesh: THREE.Mesh | null
  material: THREE.MeshBasicMaterial | null
  texture: THREE.Texture | null
  // Lazily computed local-space ground bounds (plane at the tile height).
  bounds: GroundRect | null
  // Serial of the in-flight download attempt; callbacks from an earlier
  // (timed-out) attempt of the same node are recognised and dropped by it.
  loadToken?: number
  // performance.now() stamp of the running fade-in; 0 when none.
  fadeStart: number
  // Whether the node has been fully on screen once; cached re-appearances
  // (zooming back into an evicted area) show instantly.
  shownOnce: boolean
  // Key of the ancestor kept rendered beneath this node's running fade.
  underlayKey?: string
}

/**
 * Build the ground quad for one tile. Each corner is projected through the
 * scene's GeoReference in the tile source datum, which absorbs the non-linear
 * GCJ02 shift per corner so GCJ02-encrypted imagery stays seamless. The quad
 * is then expanded slightly around its centre (see TILE_OVERLAP_RATIO).
 */
function createTileGeometry(
  index: TileIndex,
  geo: GeoReference,
  datum: DatumType,
  height: number
): THREE.BufferGeometry {
  const { nw, ne, se, sw } = tileToCorners(index)
  const pNW = geo.toLocal(nw, datum)
  const pNE = geo.toLocal(ne, datum)
  const pSE = geo.toLocal(se, datum)
  const pSW = geo.toLocal(sw, datum)

  const centreX = (pNW.x + pNE.x + pSE.x + pSW.x) / 4
  const centreZ = (pNW.z + pNE.z + pSE.z + pSW.z) / 4
  const scale = 1 + TILE_OVERLAP_RATIO
  const expand = (point: { x: number; z: number }): { x: number; z: number } => ({
    x: centreX + (point.x - centreX) * scale,
    z: centreZ + (point.z - centreZ) * scale
  })
  const eNW = expand(pNW)
  const eNE = expand(pNE)
  const eSE = expand(pSE)
  const eSW = expand(pSW)

  const positions = new Float32Array([
    eNW.x,
    height,
    eNW.z,
    eNE.x,
    height,
    eNE.z,
    eSE.x,
    height,
    eSE.z,
    eSW.x,
    height,
    eSW.z
  ])
  // UVs reach just beyond [0, 1] on the expanded border; the texture's
  // ClampToEdge wrapping turns that into the edge pixels being stretched over
  // the overlap strip instead of wrapping to the opposite side of the image.
  const uvPad = TILE_OVERLAP_RATIO / 2
  const uvs = new Float32Array([
    -uvPad,
    1 + uvPad,
    1 + uvPad,
    1 + uvPad,
    1 + uvPad,
    -uvPad,
    -uvPad,
    -uvPad
  ])

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  geometry.setIndex([0, 1, 2, 0, 2, 3])
  return geometry
}

/** Local-space centre of a tile's ground quad. */
function boundsCenter(bounds: GroundRect): { x: number; z: number } {
  return {
    x: (bounds.minX + bounds.maxX) / 2,
    z: (bounds.minZ + bounds.maxZ) / 2
  }
}

/**
 * Compute a tile's local-space ground bounds, in metres, from its geographic
 * corners (without the render overlap). The result is cached on the node.
 */
function computeBounds(node: TileLayerNode, geo: GeoReference, datum: DatumType): GroundRect {
  if (node.bounds) return node.bounds
  const { nw, ne, se, sw } = tileToCorners(node.index)
  const pNW = geo.toLocal(nw, datum)
  const pNE = geo.toLocal(ne, datum)
  const pSE = geo.toLocal(se, datum)
  const pSW = geo.toLocal(sw, datum)
  const bounds: GroundRect = {
    minX: Math.min(pNW.x, pNE.x, pSE.x, pSW.x),
    maxX: Math.max(pNW.x, pNE.x, pSE.x, pSW.x),
    minZ: Math.min(pNW.z, pNE.z, pSE.z, pSW.z),
    maxZ: Math.max(pNW.z, pNE.z, pSE.z, pSW.z)
  }
  node.bounds = bounds
  return bounds
}

export default defineComponent({
  name: 'TvTileLayer',
  props: {
    /** URL template of the XYZ tile source. */
    url: {
      type: String,
      required: true
    },
    /** Slippy-map zoom level (non-negative integer). */
    zoom: {
      type: Number,
      required: true
    },
    /** Static geographic coverage; ignored when `followCamera` is enabled. */
    points: {
      type: Array as PropType<GeoPoint[]>
    },
    /** Keep the layer centred on the camera. Defaults to true. */
    followCamera: {
      type: Boolean,
      default: true
    },
    /** Datum of the tile imagery. Defaults to the Scene's configured datum. */
    datum: {
      type: String as PropType<DatumType>
    },
    /** Extra rings of tiles beyond the visible rectangle. Defaults to 1. */
    padding: {
      type: Number,
      default: DEFAULT_PADDING
    },
    /** Optional {s} subdomain list. Defaults to a/b/c. */
    subdomains: {
      type: Array as PropType<string[]>
    },
    /** Opacity of the tile images. Defaults to 1. */
    opacity: {
      type: Number,
      default: DEFAULT_OPACITY
    },
    /** Height in local metres at which the ground quads are laid. Defaults to 0.05. */
    y: {
      type: Number,
      default: DEFAULT_Y
    },
    /** Air-perspective fading towards the horizon. Defaults to true. */
    fog: {
      type: Boolean,
      default: true
    },
    /** Colour of the distance fog and backing ground plane. */
    groundColor: {
      type: [String, Number, Object] as PropType<THREE.ColorRepresentation>
    },
    /** Safety cap on simultaneously retained tiles. Defaults to 256. */
    maxTiles: {
      type: Number,
      default: DEFAULT_MAX_TILES
    },
    /** Largest OrbitControls polar angle while following the camera. */
    maxPolarAngle: {
      type: Number,
      default: DEFAULT_MAX_POLAR_ANGLE
    },
    /** Called once with the layer group after it was added to the scene. */
    onReady: {
      type: Function as PropType<(group: THREE.Group) => void>
    },
    /** Called when one tile image fails to download. */
    onTileError: {
      type: Function as PropType<(index: TileIndex, url: string) => void>
    },
    /** Optional explicit scene; defaults to the Scene provided by context. */
    scene: {
      type: Object as PropType<THREE.Scene>
    }
  },
  setup(props) {
    const sceneContext = useScene()

    let group: THREE.Group | null = null
    let loader: THREE.TextureLoader | THREE.ImageBitmapLoader | null = null
    let pyramid: TilePyramid<TileLayerNode> | null = null
    let cleanupRef: (() => void) | null = null
    let disposed = false

    function create() {
      destroy()
      disposed = false

      let disposeAfterFrame: (() => void) | undefined
      let restoreControls: (() => void) | undefined
      let trailingTimer = 0
      let retryTimer = 0
      let intervalTimer = 0
      let cleanupAtmosphere: (() => void) | undefined
      let disposeAtmosphereFrame: (() => void) | undefined
      let disposeFadeFrame: (() => void) | undefined

      // Quadtree selection state: the ideal set per traversal, the atomic
      // render set and the LRU cache all live in the TilePyramid. This closure
      // only owns the Three.js resources and the download scheduling.
      const layerPyramid = new TilePyramid<TileLayerNode>({
        maxLoadAttempts: MAX_LOAD_ATTEMPTS,
        createNode: (index) => ({
          index,
          state: TileState.Idle,
          attempts: 0,
          lastSeen: 0,
          queued: false,
          rendering: false,
          mesh: null,
          material: null,
          texture: null,
          bounds: null,
          fadeStart: 0,
          shownOnce: false
        })
      })
      pyramid = layerPyramid
      const nodes = layerPyramid.nodes
      let activeLoads = 0
      let loadSerial = 0

      // Zoom-bucketed download queue: coarse buckets drain first so the layer
      // streams from the root covers down; within one bucket the tile nearest
      // the camera loads first.
      const queueBuckets = new Map<number, Set<string>>()

      // Nodes with a running fade-in. One shared per-frame ticker advances
      // them all - never one animation callback per tile.
      const fading = new Set<string>()
      // Refcount per underlay key: a coarse ancestor kept visible beneath one
      // or more crossfading children until their fades complete.
      const underlayRefs = new Map<string, number>()
      // Fades need the Scene's per-frame hook; without a ticker the tiles
      // would sit at opacity 0, so they must appear instantly instead.
      const canFade = typeof sceneContext.addAfterFrame === 'function'

      /** Drop one underlay reference and hide the ancestor once unreferenced. */
      const releaseUnderlay = (node: TileLayerNode): void => {
        const key = node.underlayKey
        if (!key) return
        node.underlayKey = undefined
        const refs = (underlayRefs.get(key) ?? 1) - 1
        if (refs > 0) {
          underlayRefs.set(key, refs)
          return
        }
        underlayRefs.delete(key)
        const underlay = nodes.get(key)
        if (underlay?.mesh && !underlay.rendering) underlay.mesh.visible = false
      }

      /** Finish or cancel a node's fade and release its underlay. */
      const endFade = (node: TileLayerNode): void => {
        if (!node.fadeStart) return
        node.fadeStart = 0
        fading.delete(tileKey(node.index))
        releaseUnderlay(node)
      }

      /**
       * Advance every running fade-in once per frame. Finished, hidden or
       * evicted nodes drop out of the set, so the ticker costs nothing once
       * all imagery has settled.
       */
      const tickFades = (): void => {
        if (disposed || fading.size === 0) return
        const now = performance.now()
        fading.forEach((key) => {
          const node = nodes.get(key)
          if (!node || !node.rendering || !node.material || !node.fadeStart) {
            if (node) endFade(node)
            else fading.delete(key)
            return
          }
          const progress = Math.min((now - node.fadeStart) / FADE_DURATION_MS, 1)
          // Ease-out cubic: quick ramp, gentle landing.
          node.material.opacity = props.opacity * (1 - (1 - progress) ** 3)
          if (progress >= 1) {
            node.shownOnce = true
            endFade(node)
          }
        })
      }

      const disposeNodeResources = (node: TileLayerNode) => {
        if (node.mesh) {
          node.mesh.removeFromParent()
          node.mesh.geometry.dispose()
        }
        node.texture?.dispose()
        node.material?.dispose()
        endFade(node)
        node.mesh = null
        node.material = null
        node.texture = null
      }

      const init = () => {
        if (disposed) return
        const scene = props.scene || sceneContext.scene
        const geo = (scene ? getSceneGeo(scene) : undefined) ?? sceneContext.geo
        if (!scene || !geo) {
          retryTimer = window.setTimeout(init, 100)
          return
        }
        const effectiveDatum: DatumType = props.datum ?? geo.datum
        const layerY = props.y
        const maxTiles = props.maxTiles

        // Camera-driven tiling needs the context camera; an explicit scene prop
        // without context can only use the static `points` coverage.
        const contextCamera = sceneContext.sceneComponents?.camera
        const dynamic =
          props.followCamera && !props.scene && contextCamera instanceof THREE.PerspectiveCamera

        if (!dynamic) {
          if (!props.points || props.points.length === 0) return
          const staticLeaves = selectTiles(props.points, props.zoom)
          if (staticLeaves.length === 0) return
          if (staticLeaves.length > maxTiles) {
            throw new Error(
              `TileLayer: selected ${staticLeaves.length} tiles at zoom ${props.zoom}, which exceeds the maxTiles limit of ${maxTiles}`
            )
          }
        }

        const layerGroup = new THREE.Group()
        layerGroup.name = 'TileLayer'
        // Decode tile imagery off the render thread: ImageBitmapLoader hands
        // the PNG bytes to createImageBitmap, which decodes in a worker, so a
        // burst of arrivals no longer decodes on the main thread the way
        // TextureLoader's <img> path does. Browsers without the API (and
        // jsdom) fall back to TextureLoader.
        const supportsWorkerDecode =
          typeof createImageBitmap === 'function' && typeof fetch === 'function'
        const layerLoader: THREE.TextureLoader | THREE.ImageBitmapLoader = supportsWorkerDecode
          ? new THREE.ImageBitmapLoader().setOptions({ imageOrientation: 'flipY' })
          : new THREE.TextureLoader()
        layerLoader.setCrossOrigin('anonymous')
        loader = layerLoader
        scene.add(layerGroup)
        group = layerGroup
        props.onReady?.(layerGroup)
        if (canFade) {
          disposeFadeFrame = sceneContext.addAfterFrame?.(() => tickFades())
        }

        // Air perspective: height-scaled linear fog plus a large backing plane
        // tinted to the background colour. Tiles end where fog becomes opaque
        // (see MAX_GROUND_RANGE_FACTOR), so the rectangular tile edge and the
        // map sides at oblique angles dissolve into the backing instead of
        // floating over an empty background. Until the first tiles have landed
        // the backing also fills the whole view, so the layer shows a solid
        // ground colour instead of flashing the raw background on mount.
        const resolveGroundColor = (): THREE.Color => {
          const explicit = props.groundColor
          if (explicit !== undefined) return new THREE.Color(explicit)
          if (scene.background instanceof THREE.Color) return scene.background.clone()
          return new THREE.Color(DEFAULT_GROUND_COLOR)
        }
        const groundTint = resolveGroundColor()
        const backingGeometry = new THREE.PlaneGeometry(1, 1)
        const backingMaterial = new THREE.MeshBasicMaterial({
          color: groundTint,
          side: THREE.DoubleSide,
          fog: false,
          // The backing sits 0.01 m below the tile quads, but with the GIS
          // near/far ratio (0.1/4000) one depth step at a few hundred metres is
          // already tens of centimetres: larger than the gap, so the two layers
          // z-fight and at certain zoom distances the tiles lose every fragment
          // to the backing (the whole map turns into the background colour).
          // The backing is the farthest thing in the layer, so it must not write
          // depth at all: it can never occlude anything, and the transparent
          // tile quads (drawn after opaque geometry) simply paint on top of it.
          depthWrite: false
        })
        const backing = new THREE.Mesh(backingGeometry, backingMaterial)
        backing.name = 'TileLayer_Backing'
        backing.rotation.x = -Math.PI / 2
        backing.position.y = layerY - 0.01
        backing.visible = true
        layerGroup.add(backing)

        const previousFog = scene.fog
        const layerFog = new THREE.Fog(groundTint, 1, 1000)
        // Far plane the camera had before this layer extended it, plus the camera
        // it belongs to; both are restored on unmount.
        let baseCameraFar = -1
        let farPlaneCamera: THREE.PerspectiveCamera | null = null

        let hasVisibleTiles = false

        const applyAtmosphere = (camera: THREE.PerspectiveCamera | null, orbitDistance = -1) => {
          const height = Math.max((camera?.position.y ?? layerY + 200) - layerY, 1)
          const halfSize = height * BACKING_HALF_SIZE_FACTOR
          backing.scale.set(halfSize * 2, halfSize * 2, 1)
          backing.position.x = camera?.position.x ?? 0
          backing.position.z = camera?.position.z ?? 0
          // Cesium re-fits the frustum far plane to the camera altitude every
          // frame. A fixed far plane is fine near the ground but, once the camera
          // climbs, the tilted ground plane is clipped mid-frame: everything
          // beyond the nadir clip distance vanishes and a hard band of empty
          // background cuts across the view. Extend the far plane to cover the
          // fog range plus the orbit distance, and only rebuild the projection
          // when it actually moved.
          if (camera && farPlaneCamera !== camera) {
            baseCameraFar = camera.far
            farPlaneCamera = camera
          }
          if (camera && baseCameraFar > 0) {
            const requiredFar = Math.max(
              baseCameraFar,
              height * FOG_FAR_FACTOR * 1.5 + Math.max(orbitDistance, 0)
            )
            if (Math.abs(camera.far - requiredFar) > requiredFar * 0.01) {
              camera.far = requiredFar
              camera.updateProjectionMatrix()
            }
          }
          if (props.fog) {
            scene.fog = layerFog
            // Height-scaled fog breaks once the camera dollies: the fog band
            // slides across the frame instead of staying at the edge of the
            // tiled coverage. Anchor it to that edge instead: the tiles the
            // sampler can still provide end at `rangeCap` metres of ground
            // range, so the fog must be fully opaque exactly at the slant
            // distance to that edge and start fading only past the frame's own
            // content (never in front of the orbit target).
            const horizontal =
              orbitDistance > 0
                ? Math.sqrt(Math.max(orbitDistance * orbitDistance - height * height, 0))
                : 0
            const rangeCap = height * MAX_GROUND_RANGE_FACTOR
            const edgeDistance = Math.sqrt(Math.max(rangeCap - horizontal, 0) ** 2 + height * height)
            layerFog.near = Math.max(
              edgeDistance * 0.55,
              orbitDistance > 0 ? orbitDistance * 1.1 : height * 2
            )
            layerFog.far = Math.max(layerFog.near * 1.05, edgeDistance)
            backing.visible = true
            return
          }
          if (scene.fog === layerFog) scene.fog = previousFog
          // Without fog the backing is only a placeholder until imagery exists.
          backing.visible = !hasVisibleTiles
        }
        cleanupAtmosphere = () => {
          disposeAtmosphereFrame?.()
          if (scene.fog === layerFog) scene.fog = previousFog
          if (farPlaneCamera && baseCameraFar > 0 && farPlaneCamera.far !== baseCameraFar) {
            farPlaneCamera.far = baseCameraFar
            farPlaneCamera.updateProjectionMatrix()
          }
          backing.removeFromParent()
          backingGeometry.dispose()
          backingMaterial.dispose()
        }

        const buildNodeMesh = (node: TileLayerNode) => {
          const geometry = createTileGeometry(node.index, geo, effectiveDatum, layerY)
          const material = new THREE.MeshBasicMaterial({
            transparent: true,
            opacity: props.opacity,
            depthWrite: false,
            side: THREE.DoubleSide
          })
          const mesh = new THREE.Mesh(geometry, material)
          mesh.name = `Tile_${node.index.z}_${node.index.x}_${node.index.y}`
          // Coverage is chosen analytically from the camera frustum, so let the GPU
          // draw every rendered quad: a single coarser ancestor can span kilometres
          // where the bounding-sphere frustum test gains little and may drop quads.
          mesh.frustumCulled = false
          mesh.visible = false
          if (node.texture) {
            material.map = node.texture
            material.needsUpdate = true
          }
          layerGroup.add(mesh)
          node.mesh = mesh
          node.material = material
        }

        /**
         * Nearest ancestor that is on screen (or about to become on screen in
         * this same render-set pass), used as the crossfade underlay beneath a
         * newly appearing tile.
         */
        const nearestVisibleAncestorKey = (node: TileLayerNode): string | null => {
          let { z, x, y } = node.index
          while (z > 0) {
            z -= 1
            x = Math.floor(x / 2)
            y = Math.floor(y / 2)
            const ancestor = nodes.get(tileKey({ z, x, y }))
            if (ancestor?.mesh && (ancestor.mesh.visible || ancestor.rendering)) {
              return tileKey(ancestor.index)
            }
          }
          return null
        }

        /**
         * Apply the pyramid's render set to the meshes: lazily create the mesh
         * of a node that just became visible, toggle every mesh's visibility
         * and start fade-ins. Newly visible nodes are classified before any
         * visibility flips, so an ancestor replaced by its children still
         * counts as on screen and becomes the crossfade underlay. Tiles that
         * have been on screen before reappear instantly, like MapLibre's
         * cached tiles.
         */
        const applyRenderSet = () => {
          layerPyramid.renderSet()
          const appearing: TileLayerNode[] = []
          nodes.forEach((node) => {
            if (node.rendering && (!node.mesh || !node.mesh.visible)) appearing.push(node)
          })
          const now = performance.now()
          appearing.forEach((node) => {
            if (!node.mesh) buildNodeMesh(node)
            if (!node.material) return
            if (!canFade || node.shownOnce) {
              node.shownOnce = true
              node.material.opacity = props.opacity
              return
            }
            node.fadeStart = now
            node.material.opacity = 0
            const underlayKey = nearestVisibleAncestorKey(node)
            if (underlayKey) {
              node.underlayKey = underlayKey
              underlayRefs.set(underlayKey, (underlayRefs.get(underlayKey) ?? 0) + 1)
            }
            fading.add(tileKey(node.index))
          })
          let anyVisible = false
          nodes.forEach((node) => {
            if (node.rendering && !node.mesh) buildNodeMesh(node)
            if (node.mesh) {
              node.mesh.visible = node.rendering || underlayRefs.has(tileKey(node.index))
            }
            if (node.rendering) anyVisible = true
            if (!node.rendering) endFade(node)
          })
          hasVisibleTiles = anyVisible
        }

        const resetQueue = () => {
          queueBuckets.clear()
          nodes.forEach((node) => {
            node.queued = false
          })
        }

        const enqueue = (node: TileLayerNode) => {
          if (node.queued || node.state === TileState.Loading || node.state === TileState.Loaded) {
            return
          }
          node.queued = true
          const bucketLevel = node.index.z
          let bucket = queueBuckets.get(bucketLevel)
          if (!bucket) {
            bucket = new Set<string>()
            queueBuckets.set(bucketLevel, bucket)
          }
          bucket.add(tileKey(node.index))
        }

        /** Squared distance from a node centre to the camera, used to load nearer
         * tiles first within one zoom level. */
        const nodeDistanceSquared = (
          node: TileLayerNode,
          camera: THREE.PerspectiveCamera
        ): number => {
          const bounds = node.bounds
          if (!bounds) return Infinity
          const center = boundsCenter(bounds)
          const dx = center.x - camera.position.x
          const dz = center.z - camera.position.z
          return dx * dx + dz * dz
        }

        const nextQueuedKey = (camera: THREE.PerspectiveCamera | null): string | null => {
          const levels = Array.from(queueBuckets.keys()).sort((a, b) => a - b)
          for (const level of levels) {
            const bucket = queueBuckets.get(level)
            if (!bucket || bucket.size === 0) continue
            if (!camera) {
              const anyKey = bucket.values().next().value as string | undefined
              if (anyKey) {
                bucket.delete(anyKey)
                if (bucket.size === 0) queueBuckets.delete(level)
                return anyKey
              }
              return null
            }
            let nearestKey: string | null = null
            let nearestDistance = Infinity
            bucket.forEach((key) => {
              const node = nodes.get(key)
              if (!node) {
                bucket.delete(key)
                return
              }
              const distance = nodeDistanceSquared(node, camera)
              if (distance < nearestDistance) {
                nearestDistance = distance
                nearestKey = key
              }
            })
            if (nearestKey) {
              bucket.delete(nearestKey)
              if (bucket.size === 0) queueBuckets.delete(level)
              return nearestKey
            }
          }
          return null
        }

        const pump = () => {
          const cameraForQueue =
            contextCamera instanceof THREE.PerspectiveCamera ? contextCamera : null
          while (activeLoads < MAX_CONCURRENT_LOADS) {
            const key = nextQueuedKey(cameraForQueue)
            if (!key) break
            const node = nodes.get(key)
            if (!node) continue
            node.queued = false
            startLoad(node)
          }
        }

        /** Release an unused load result: Texture dispose / ImageBitmap close. */
        const discardLoadResult = (result: THREE.Texture | ImageBitmap): void => {
          if (result instanceof THREE.Texture) result.dispose()
          else result.close()
        }

        /**
         * Shared texture setup. Raster tiles stay near 1:1 screen size (SSE
         * 256), so a mip chain would only cost upload time and GPU memory;
         * plain linear filtering is what MapLibre uses for raster tiles.
         */
        const configureTileTexture = (texture: THREE.Texture): void => {
          texture.colorSpace = THREE.SRGBColorSpace
          texture.generateMipmaps = false
          texture.minFilter = THREE.LinearFilter
          texture.magFilter = THREE.LinearFilter
        }

        /**
         * Normalise a load result into a tile texture. ImageBitmapLoader
         * resolves the worker-decoded bitmap, already flipped by its
         * imageOrientation option, so upload-time flipping stays off on both
         * renderer backends; TextureLoader resolves a ready-made Texture.
         */
        const prepareTileTexture = (result: THREE.Texture | ImageBitmap): THREE.Texture => {
          if (result instanceof THREE.Texture) {
            configureTileTexture(result)
            return result
          }
          const texture = new THREE.Texture(result)
          texture.flipY = false
          texture.needsUpdate = true
          configureTileTexture(texture)
          return texture
        }

        const startLoad = (node: TileLayerNode) => {
          node.state = TileState.Loading
          activeLoads += 1
          // Token for this attempt: when a timed-out request's callbacks finally
          // arrive, a retry may already be in flight for the same node, and the
          // stale callbacks must not fail the fresh attempt, drop its texture or
          // corrupt the concurrency counter.
          const token = ++loadSerial
          node.loadToken = token
          const requestUrl = tileUrl(props.url, node.index, props.subdomains)
          const handleFailure = () => {
            if (disposed) {
              activeLoads -= 1
              return
            }
            props.onTileError?.(node.index, requestUrl)
            activeLoads -= 1
            if (node.attempts < MAX_LOAD_ATTEMPTS) {
              node.attempts += 1
              node.state = TileState.Failed
              enqueue(node)
            } else {
              node.state = TileState.Failed
              node.queued = false
            }
            pump()
          }
          let timeoutId = 0
          const settle = () => {
            window.clearTimeout(timeoutId)
          }
          timeoutId = window.setTimeout(() => {
            // A download wedged past the ceiling fails fast into the retry
            // queue instead of blocking its node for the browser's TCP timeout.
            if (disposed || node.loadToken !== token) return
            handleFailure()
          }, TILE_LOAD_TIMEOUT_MS)
          layerLoader.load(
            requestUrl,
            (result: THREE.Texture | ImageBitmap) => {
              settle()
              if (disposed) {
                discardLoadResult(result)
                activeLoads -= 1
                return
              }
              if (node.loadToken !== token) {
                // Stale attempt (already timed out and counted): drop the image.
                discardLoadResult(result)
                return
              }
              node.texture = prepareTileTexture(result)
              node.state = TileState.Loaded
              activeLoads -= 1
              applyRenderSet()
              pump()
            },
            undefined,
            () => {
              settle()
              if (disposed) {
                activeLoads -= 1
                return
              }
              if (node.loadToken !== token) {
                // Stale attempt; its load slot was already released by timeout.
                return
              }
              handleFailure()
            }
          )
        }

        // Tile screen-space error in CSS pixels. A tile of on-ground size g seen
        // from distance d projects to roughly g * viewportHeight /
        // (2 d tan(fov/2)) pixels; it needs refining once that exceeds the
        // threshold. The vertical gap to the plane counts toward d so a
        // top-down view uses its height, not a near-zero distance.
        const screenSpaceError = (node: TileLayerNode, camera: THREE.PerspectiveCamera): number => {
          const bounds = computeBounds(node, geo, effectiveDatum)
          const center = boundsCenter(bounds)
          const groundWidth = Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ)
          const dx = center.x - camera.position.x
          const dz = center.z - camera.position.z
          const dy = Math.max(camera.position.y - layerY, 0)
          const distance = Math.max(Math.hypot(dx, dz, dy), camera.near)
          const canvasHeight = sceneContext.renderer?.domElement?.clientHeight
          const viewportHeight =
            canvasHeight && canvasHeight > 0 ? canvasHeight : window.innerHeight || 1
          const fovFactor = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)
          return (groundWidth * viewportHeight) / (distance * fovFactor)
        }

        const updateDynamic = () => {
          const camera = contextCamera as THREE.PerspectiveCamera
          camera.updateMatrixWorld()
          const samples = sampleVisibleGround(camera, layerY)
          const rect: GroundRect = {
            minX: Math.min(...samples.map((sample) => sample.x)),
            maxX: Math.max(...samples.map((sample) => sample.x)),
            minZ: Math.min(...samples.map((sample) => sample.z)),
            maxZ: Math.max(...samples.map((sample) => sample.z))
          }

          resetQueue()

          // The padding margin is derived once from the target zoom's centre
          // leaf tile, so every level of the pyramid shares one ground-distance
          // ring around the visible rectangle.
          const footprintCenter = new THREE.Vector3(
            (rect.minX + rect.maxX) / 2,
            layerY,
            (rect.minZ + rect.maxZ) / 2
          )
          const centerGeo = geo.toGeo(footprintCenter, effectiveDatum)
          const leafCenterTile = lngLatToTile(centerGeo.lng, centerGeo.lat, props.zoom)
          const leafBounds = computeBounds(
            layerPyramid.getOrCreate(leafCenterTile),
            geo,
            effectiveDatum
          )
          const leafGroundSize = Math.max(
            leafBounds.maxX - leafBounds.minX,
            leafBounds.maxZ - leafBounds.minZ,
            1e-6
          )
          const coverageMargin = leafGroundSize * Math.max(props.padding, 0)

          layerPyramid.selectIdeal({
            rect,
            boundsOf: (index) =>
              computeBounds(layerPyramid.getOrCreate(index), geo, effectiveDatum),
            margin: coverageMargin,
            maxZoom: props.zoom,
            shouldRefine: (index) =>
              screenSpaceError(layerPyramid.getOrCreate(index), camera) >= SSE_THRESHOLD_PX,
            maxIdealNodes: MAX_IDEAL_NODES
          })

          // Queue every ideal node without usable imagery: coarse ancestors and
          // fine leaves are requested together, so the layer streams from the
          // root covers straight to full detail instead of blocking level by
          // level. The queue drains coarse buckets first.
          layerPyramid.pendingIdeal().forEach((node) => {
            enqueue(node)
          })

          applyRenderSet()
          layerPyramid.evictStale(maxTiles, CACHE_FACTOR).forEach((node) => {
            disposeNodeResources(node)
          })
          pump()

          // Re-check after the camera has crossed roughly half an ideal tile so
          // panning streams new tiles before the covered edge reaches the border.
          let smallestGroundSize = Infinity
          nodes.forEach((node) => {
            if (node.rendering && node.bounds) {
              const size = Math.max(
                node.bounds.maxX - node.bounds.minX,
                node.bounds.maxZ - node.bounds.minZ
              )
              smallestGroundSize = Math.min(smallestGroundSize, size)
            }
          })
          currentThreshold = Number.isFinite(smallestGroundSize)
            ? Math.max(1, smallestGroundSize / 2)
            : Infinity
        }

        // Static coverage: the bbox of the points is filled once at the given
        // zoom. Traversal still runs the pyramid so the parent-cover rule hides
        // the initial download behind coarse ancestors instead of black holes.
        const updateStatic = () => {
          const staticPoints = props.points
          if (!staticPoints || staticPoints.length === 0) return

          const west = Math.min(...staticPoints.map((point) => point.lng))
          const east = Math.max(...staticPoints.map((point) => point.lng))
          const south = Math.min(...staticPoints.map((point) => point.lat))
          const north = Math.max(...staticPoints.map((point) => point.lat))
          const coverageRect: GroundRect = {
            minX: Infinity,
            maxX: -Infinity,
            minZ: Infinity,
            maxZ: -Infinity
          }
          ;[
            { lng: west, lat: north },
            { lng: east, lat: north },
            { lng: east, lat: south },
            { lng: west, lat: south }
          ].forEach((corner) => {
            const local = geo.toLocal(corner, effectiveDatum)
            coverageRect.minX = Math.min(coverageRect.minX, local.x)
            coverageRect.maxX = Math.max(coverageRect.maxX, local.x)
            coverageRect.minZ = Math.min(coverageRect.minZ, local.z)
            coverageRect.maxZ = Math.max(coverageRect.maxZ, local.z)
          })

          resetQueue()
          layerPyramid.selectIdeal({
            rect: coverageRect,
            boundsOf: (index) =>
              computeBounds(layerPyramid.getOrCreate(index), geo, effectiveDatum),
            maxZoom: props.zoom
          })
          layerPyramid.pendingIdeal().forEach((node) => {
            enqueue(node)
          })

          applyRenderSet()
          layerPyramid.evictStale(maxTiles, CACHE_FACTOR).forEach((node) => {
            disposeNodeResources(node)
          })
          pump()
        }

        let currentThreshold = Infinity
        let lastFillAt = 0
        const lastCheckPosition = new THREE.Vector3()
        const lastCheckTarget = new THREE.Vector3()
        const lastCheckQuaternion = new THREE.Quaternion()
        let lastOrbitDistance = -1

        const runFill = () => {
          trailingTimer = 0
          lastFillAt = performance.now()
          if (dynamic) updateDynamic()
          else updateStatic()
        }

        const scheduleFill = () => {
          // Leading edge of a gesture fills immediately; subsequent traversals
          // while the camera keeps moving are coalesced into a trailing timer,
          // which bounds queue churn and keeps zooming smooth at any altitude.
          const elapsed = performance.now() - lastFillAt
          if (elapsed >= FILL_THROTTLE_MS) {
            runFill()
            return
          }
          if (trailingTimer) return
          trailingTimer = window.setTimeout(runFill, FILL_THROTTLE_MS - elapsed)
        }

        if (dynamic) {
          const camera = contextCamera as THREE.PerspectiveCamera
          const controls = sceneContext.sceneComponents?.controls
          if (controls && typeof controls !== 'boolean') {
            // Keep the camera above the horizon so the edge-on ground plane
            // cannot stretch tile imagery across the sky, cap the zoom-out
            // distance below the camera far plane (past it every ground quad is
            // GPU-clipped and the whole map turns into empty background), and
            // floor the zoom-in distance (Cesium's minimumZoomDistance): dolling
            // into ground-level content puts the camera inside markers and slides
            // the fog band over the whole frame. In every case a stricter
            // existing limit is left untouched; the original values are restored
            // on unmount.
            const previousMaxPolarAngle = controls.maxPolarAngle
            const previousMaxDistance = controls.maxDistance
            const previousMinDistance = controls.minDistance
            const farDistanceCap = camera.far > 0 ? camera.far * 0.9 : Infinity
            const minDistanceFloor = Number.isFinite(farDistanceCap)
              ? Math.max(farDistanceCap * MIN_DISTANCE_FACTOR, 1)
              : 0
            let controlsTouched = false
            if (props.maxPolarAngle < previousMaxPolarAngle) {
              controls.maxPolarAngle = props.maxPolarAngle
              controlsTouched = true
            }
            if (farDistanceCap < previousMaxDistance) {
              controls.maxDistance = farDistanceCap
              controlsTouched = true
            }
            if (minDistanceFloor > previousMinDistance) {
              controls.minDistance = minDistanceFloor
              controlsTouched = true
            }
            if (controlsTouched) {
              controls.update()
              restoreControls = () => {
                controls.maxPolarAngle = previousMaxPolarAngle
                controls.maxDistance = previousMaxDistance
                controls.minDistance = previousMinDistance
              }
            }
          }

          const checkFrame = () => {
            if (disposed) return
            // The orbit distance feeds both the atmosphere below (edge-anchored
            // fog, far-plane fit) and the zoom trigger, so compute it once per
            // frame, before anything else uses it.
            const orbitDistance = controls && typeof controls !== 'boolean'
              ? camera.position.distanceTo(controls.target)
              : -1
            // Fog planes follow the camera every frame (cheap parameter writes),
            // independently of whether a cover traversal is scheduled.
            applyAtmosphere(camera, orbitDistance)
            // An orientation delta triggers a retile independently of movement:
            // tilting rotates about the orbit target with little translation, so
            // a displacement-only threshold could leave the selection frozen at
            // the final angle.
            const rotated = camera.quaternion.angleTo(lastCheckQuaternion) > MAX_ORIENTATION_DELTA
            // Before the first successful fill the threshold is Infinity, so the
            // first check always runs even if the camera has not moved.
            const moved =
              currentThreshold === Infinity ||
              camera.position.distanceTo(lastCheckPosition) > currentThreshold ||
              (controls && typeof controls !== 'boolean'
                ? controls.target.distanceTo(lastCheckTarget) > currentThreshold
                : false)
            // Zooming changes every tile's screen-space error without moving the
            // camera across the pan threshold (half a finest tile's ground size,
            // hundreds of metres), so a dolly would trigger no re-selection for
            // dozens of wheel steps and no tile request would ever fire. Mature
            // engines re-evaluate the pyramid on every zoom step; track the
            // orbit distance separately and re-select after a few percent of it.
            const zoomed =
              orbitDistance > 0 &&
              lastOrbitDistance > 0 &&
              Math.abs(orbitDistance - lastOrbitDistance) > lastOrbitDistance * 0.02
            if (!moved && !rotated && !zoomed) return
            lastCheckPosition.copy(camera.position)
            if (controls && typeof controls !== 'boolean' && controls.target) {
              lastCheckTarget.copy(controls.target)
            }
            lastCheckQuaternion.copy(camera.quaternion)
            lastOrbitDistance = orbitDistance
            scheduleFill()
          }

          runFill()
          const initialOrbitDistance =
            controls && typeof controls !== 'boolean'
              ? camera.position.distanceTo(controls.target)
              : -1
          applyAtmosphere(camera, initialOrbitDistance)
          lastCheckPosition.copy(camera.position)
          if (controls && typeof controls !== 'boolean' && controls.target) {
            lastCheckTarget.copy(controls.target)
          }
          lastOrbitDistance = initialOrbitDistance
          // addAfterFrame is required rather than addBeforeFrame: the latter
          // switches the Scene into a layer-compositing render path that skips
          // the per-frame clear, which on WebGPU leaves trails behind moving
          // markers and tiles during an orbit/drag gesture.
          if (sceneContext.addAfterFrame) {
            disposeAfterFrame = sceneContext.addAfterFrame(checkFrame)
          } else {
            intervalTimer = window.setInterval(checkFrame, 200)
          }
        } else {
          runFill()
          const staticCamera =
            sceneContext.sceneComponents?.camera instanceof THREE.PerspectiveCamera
              ? sceneContext.sceneComponents.camera
              : null
          if (staticCamera && sceneContext.addAfterFrame) {
            applyAtmosphere(staticCamera)
            disposeAtmosphereFrame = sceneContext.addAfterFrame(() => {
              if (!disposed) applyAtmosphere(staticCamera)
            })
          } else {
            applyAtmosphere(null)
          }
        }
      }

      init()

      // Teardown of this build; also called before a rebuild.
      cleanupRef = () => {
        disposed = true
        window.clearTimeout(retryTimer)
        window.clearTimeout(trailingTimer)
        window.clearInterval(intervalTimer)
        disposeAfterFrame?.()
        disposeFadeFrame?.()
        restoreControls?.()
        cleanupAtmosphere?.()
        layerPyramid.clear().forEach((node) => {
          disposeNodeResources(node)
        })
        if (group) {
          group.removeFromParent()
          group = null
        }
        loader = null
        pyramid = null
      }
    }

    function destroy() {
      if (cleanupRef) {
        cleanupRef()
        cleanupRef = null
      }
      disposed = true
    }

    onMounted(create)
    onBeforeUnmount(destroy)

    // Rebuild when a structural prop changes (the Scene context is published
    // asynchronously, so the first build retries until it is available).
    watch(
      () => [
        props.scene,
        props.url,
        props.points,
        props.zoom,
        props.followCamera,
        props.datum,
        props.padding,
        props.subdomains,
        props.y,
        props.maxTiles,
        props.maxPolarAngle
      ],
      create
    )

    // Opacity is a live material property, so updating it must not rebuild the
    // pyramid or drop the loaded tiles.
    watch(
      () => props.opacity,
      (value) => {
        pyramid?.nodes.forEach((node) => {
          if (node.material) node.material.opacity = value
        })
      }
    )
  },
  render() {
    return null
  }
})
