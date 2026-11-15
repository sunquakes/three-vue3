import { defineComponent, onBeforeUnmount, onMounted, PropType, watch } from 'vue'
import * as THREE from 'three'
import { NodeMaterial } from 'three/webgpu'
import {
  Fn,
  uniform,
  float,
  vec2,
  vec3,
  vec4,
  uv,
  attribute,
  positionLocal,
  modelViewMatrix,
  cameraProjectionMatrix,
  varying,
  mod,
  smoothstep,
  oneMinus,
  length,
  max,
  mix,
  saturate,
  texture,
  viewportSize
} from 'three/tsl'
import type { Node } from 'three/webgpu'
import { useScene } from '../context/SceneContext'
import { RAIN_FALL_RATE, createFlatHeightMap, resolveRainGround } from '../utils/RainGround'

export default defineComponent({
  name: 'TvRain',
  props: {
    count: {
      type: Number,
      default: 4000
    },
    color: {
      type: [String, Number, Object] as PropType<string | number | THREE.Color>,
      default: 0xb0c4de
    },
    speed: {
      type: Number,
      default: 1
    },
    range: {
      type: Number,
      default: 20
    },
    height: {
      type: Number,
      default: 15
    },
    windX: {
      type: Number,
      default: 0.1
    },
    windZ: {
      type: Number,
      default: 0
    },
    opacity: {
      type: Number,
      default: 0.8
    },
    /** Grayscale height map (URL or texture) the drops collide with. */
    heightMap: {
      type: [String, Object] as PropType<string | THREE.Texture>
    },
    /** World size covered by the height map, centred on the origin. */
    heightMapSize: {
      type: Number
    },
    /** Vertical extent added by the height map above `groundHeight`. */
    heightMapAmplitude: {
      type: Number
    },
    /** Base ground Y. Defaults to the bottom of the rain volume. */
    groundHeight: {
      type: Number
    },
    /** Render an expanding ripple where each drop lands. */
    splash: {
      type: Boolean,
      default: true
    },
    splashColor: {
      type: [String, Number, Object] as PropType<string | number | THREE.Color>,
      default: 0xd6ecff
    },
    /** World radius of the ripple at its widest. */
    splashSize: {
      type: Number,
      default: 0.9
    },
    /** Lifetime of a ripple in seconds. */
    splashDuration: {
      type: Number,
      default: 0.6
    }
  },
  setup(props) {
    const sceneContext = useScene()

    let mesh: THREE.Mesh | null = null
    let splashMesh: THREE.Mesh | null = null
    let geometry: THREE.BufferGeometry | null = null
    let material: NodeMaterial | null = null
    let splashMaterial: NodeMaterial | null = null
    let flatHeightMap: THREE.Texture | null = null
    let loadedHeightMap: THREE.Texture | null = null
    let timeUniform: ReturnType<typeof uniform> | null = null
    let animationId: number | null = null
    let disposed = false

    function destroy() {
      disposed = true
      if (animationId !== null) {
        cancelAnimationFrame(animationId)
        animationId = null
      }
      const scene = sceneContext.scene
      if (mesh && scene) scene.remove(mesh)
      if (splashMesh && scene) scene.remove(splashMesh)
      geometry?.dispose()
      material?.dispose()
      splashMaterial?.dispose()
      flatHeightMap?.dispose()
      loadedHeightMap?.dispose()
      mesh = null
      splashMesh = null
      geometry = null
      material = null
      splashMaterial = null
      flatHeightMap = null
      loadedHeightMap = null
      timeUniform = null
    }

    function create() {
      destroy()
      disposed = false

      const { scene, sceneComponents, renderer } = sceneContext
      if (!scene || !sceneComponents?.camera) {
        return
      }

      const {
        count,
        color,
        speed,
        range,
        height,
        windX,
        windZ,
        opacity,
        heightMap,
        heightMapSize,
        heightMapAmplitude,
        groundHeight,
        splash,
        splashColor,
        splashSize,
        splashDuration
      } = props

      const fallHeight = Math.max(height, 0.001)
      const ground = resolveRainGround({
        height: fallHeight,
        range,
        groundHeight,
        heightMapAmplitude,
        heightMapSize,
        splashDuration,
        speed
      })
      const splashRadius = Math.max(splashSize, 0.01)

      // Quad-based particle geometry: 4 vertices per particle, 6 indices per
      // particle. Each particle is a billboard quad; per-particle attributes are
      // repeated once per quad vertex so the vertex shader can read them.
      const quadCorners = [
        [-0.5, -0.5],
        [0.5, -0.5],
        [-0.5, 0.5],
        [0.5, 0.5]
      ]
      const quadUVs = [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1]
      ]

      const positions = new Float32Array(count * 4 * 3)
      const uvs = new Float32Array(count * 4 * 2)
      const initialPosArr = new Float32Array(count * 4 * 3)
      const speedArr = new Float32Array(count * 4)

      for (let i = 0; i < count; i++) {
        const x = (Math.random() - 0.5) * range
        const z = (Math.random() - 0.5) * range
        const y = Math.random()
        const particleSpeed = 0.5 + Math.random() * 0.5

        for (let j = 0; j < 4; j++) {
          const vIdx = i * 4 + j
          // Quad corner position
          positions[vIdx * 3] = quadCorners[j][0]
          positions[vIdx * 3 + 1] = quadCorners[j][1]
          positions[vIdx * 3 + 2] = 0
          // UV
          uvs[vIdx * 2] = quadUVs[j][0]
          uvs[vIdx * 2 + 1] = quadUVs[j][1]
          // Per-particle data (same for all 4 vertices of the quad)
          initialPosArr[vIdx * 3] = x
          initialPosArr[vIdx * 3 + 1] = y
          initialPosArr[vIdx * 3 + 2] = z
          speedArr[vIdx] = particleSpeed
        }
      }

      // Indices: two triangles per quad
      const indices = new Uint32Array(count * 6)
      for (let i = 0; i < count; i++) {
        const base = i * 4
        const idx = i * 6
        indices[idx] = base
        indices[idx + 1] = base + 1
        indices[idx + 2] = base + 2
        indices[idx + 3] = base + 1
        indices[idx + 4] = base + 3
        indices[idx + 5] = base + 2
      }

      geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
      geometry.setAttribute('aInitialPos', new THREE.Float32BufferAttribute(initialPosArr, 3))
      geometry.setAttribute('aSpeed', new THREE.Float32BufferAttribute(speedArr, 1))
      geometry.setIndex(new THREE.BufferAttribute(indices, 1))
      const geometryRef = geometry

      // Height map sampling: a constant zero map keeps the ground flat, so the
      // shaders can sample unconditionally.
      flatHeightMap = createFlatHeightMap()
      const heightMapNode = texture(flatHeightMap)
      const flatMap = flatHeightMap

      if (typeof heightMap === 'string') {
        new THREE.TextureLoader().load(heightMap, (loaded) => {
          if (disposed) {
            loaded.dispose()
            return
          }
          loaded.wrapS = THREE.ClampToEdgeWrapping
          loaded.wrapT = THREE.ClampToEdgeWrapping
          loaded.generateMipmaps = false
          loaded.minFilter = THREE.LinearFilter
          loaded.colorSpace = THREE.NoColorSpace
          loadedHeightMap = loaded
          heightMapNode.value = loaded
        })
      } else if (heightMap) {
        heightMapNode.value = heightMap
      }

      // TSL uniforms
      const uTime = uniform(0)
      const uHeightRange = uniform(fallHeight)
      const uWindX = uniform(windX)
      const uWindZ = uniform(windZ)
      const uColor = uniform(new THREE.Color(color))
      const uSplashColor = uniform(new THREE.Color(splashColor))
      // Custom TSL materials go through a linear to sRGB conversion on WebGPU
      // final output (making colors brighter), while WebGL writes the raw value
      // directly, so pre-correct on WebGPU to make both backends match.
      if (renderer?.isWebGPURenderer === true) {
        const brightness = 0.86
        ;[uColor, uSplashColor].forEach((uniformColor) => {
          const { r, g, b } = uniformColor.value
          uniformColor.value.setRGB(
            Math.pow(r, 2.2) * brightness,
            Math.pow(g, 2.2) * brightness,
            Math.pow(b, 2.2) * brightness
          )
        })
      }
      const uOpacity = uniform(opacity)
      const uGroundY = uniform(ground.base)
      const uMapAmplitude = uniform(ground.amplitude)
      const uMapSize = uniform(ground.mapSize)
      const uSplashWindow = uniform(ground.splashWindow)
      const uSplashSize = uniform(splashRadius)
      timeUniform = uTime

      const halfHeight = uHeightRange.mul(0.5)

      // Height map -> ground Y. The map covers `mapSize` world units centred on
      // the origin and is sampled with plane UVs (u = x / size + 0.5, v = 0.5 - z
      // / size), matching a rotated PlaneGeometry used as terrain.
      const sampleGround = (x: Node<'float'>, z: Node<'float'>): Node<'float'> => {
        const u = x.div(uMapSize).add(0.5)
        const v = float(0.5).sub(z.div(uMapSize))
        return texture(heightMapNode, vec2(u, v)).r.mul(uMapAmplitude).add(uGroundY)
      }

      // Per-drop state shared by the rain and the splash shaders. `impact` is the
      // fall progress at which the drop reaches the surface; the ground is sampled
      // once below the spawn point and once below the wind-drifted landing point
      // so drops do not sink into a slope.
      const dropNodes = (aInitialPos: Node<'vec3'>, aSpeed: Node<'float'>) => {
        const t = mod(aInitialPos.y.add(uTime.mul(aSpeed).mul(RAIN_FALL_RATE)), 1.0)

        const spawnGround = sampleGround(aInitialPos.x, aInitialPos.z)
        const spawnImpact = max(
          saturate(halfHeight.sub(spawnGround).div(uHeightRange)),
          float(0.001)
        )
        const driftedX = aInitialPos.x.add(uWindX.mul(spawnImpact).mul(2.0))
        const driftedZ = aInitialPos.z.add(uWindZ.mul(spawnImpact).mul(2.0))

        const surfaceY = sampleGround(driftedX, driftedZ)
        const impact = max(saturate(halfHeight.sub(surfaceY).div(uHeightRange)), float(0.001))

        return {
          t,
          surfaceY,
          impact,
          landX: aInitialPos.x.add(uWindX.mul(impact).mul(2.0)),
          landZ: aInitialPos.z.add(uWindZ.mul(impact).mul(2.0))
        }
      }

      // vAlpha varying shared between vertex and fragment
      const vAlpha = varying(float(0))

      material = new NodeMaterial()
      material.transparent = true
      material.depthWrite = false
      material.blending = THREE.AdditiveBlending
      material.alphaTest = 0.01
      material.side = THREE.DoubleSide

      // Vertex shader: animate particle center, billboard quad in clip space
      material.vertexNode = Fn(() => {
        const aInitialPos = attribute<'vec3'>('aInitialPos', 'vec3')
        const aSpeed = attribute<'float'>('aSpeed', 'float')

        const { t, surfaceY, impact } = dropNodes(aInitialPos, aSpeed)

        // Particle center in local space. The drop stops at the surface it
        // collided with and stays there (hidden) until the cycle wraps again.
        const centerX = aInitialPos.x.add(uWindX.mul(t).mul(2.0))
        const centerY = max(oneMinus(t).mul(uHeightRange).sub(halfHeight), surfaceY)
        const centerZ = aInitialPos.z.add(uWindZ.mul(t).mul(2.0))

        // Transform center to view space
        const centerView = modelViewMatrix.mul(vec4(centerX, centerY, centerZ, 1.0))
        // Clip space center
        const centerClip = cameraProjectionMatrix.mul(centerView)

        // Point size in physical pixels with distance attenuation
        // (matches the original gl_PointSize semantics)
        const baseSize = float(4.0).add(aSpeed.mul(3.0))
        const pointSize = baseSize.mul(float(10.0).div(centerView.z.negate()))

        // Billboard offset in clip space: convert pixel size to NDC per axis,
        // then compensate for the perspective divide (multiply by clip w).
        const ndcSizeX = pointSize.div(viewportSize.x.div(2.0))
        const ndcSizeY = pointSize.div(viewportSize.y.div(2.0))
        const offsetX = positionLocal.x.mul(ndcSizeX).mul(centerClip.w)
        const offsetY = positionLocal.y.mul(ndcSizeY).mul(centerClip.w)

        // Fade in at the top of the volume and dissolve into the surface it hits
        const fadeIn = oneMinus(smoothstep(0.0, 0.05, t).mul(0.5))
        const fadeImpact = oneMinus(smoothstep(impact.sub(0.02), impact, t))
        vAlpha.assign(fadeIn.mul(fadeImpact))

        return vec4(centerClip.x.add(offsetX), centerClip.y.add(offsetY), centerClip.z, centerClip.w)
      })()

      // Fragment shader: rain drop shape using UV coordinates
      material.fragmentNode = Fn(() => {
        const coord = uv().sub(0.5)
        const distCoord = vec2(coord.x.mul(8.0), coord.y.add(0.15))
        const dist = length(distCoord)
        const alpha = oneMinus(smoothstep(0.08, 0.3, dist))
        const finalAlpha = alpha.mul(vAlpha).mul(uOpacity)
        return vec4(uColor.rgb, finalAlpha)
      })()

      mesh = new THREE.Mesh(geometryRef, material)
      mesh.name = 'Rain'
      // Geometry's position attribute holds quad corner offsets (-0.5 to 0.5),
      // but particles are spread across `range`. Disable frustum culling so the
      // mesh is not incorrectly culled by its tiny bounding box.
      mesh.frustumCulled = false
      scene.add(mesh)

      // Splash pass: one horizontal quad per drop, laid on the surface the drop
      // collided with. It shares the particle geometry and attributes.
      const vSplashFade = varying(float(0))
      const vSplashProgress = varying(float(0))

      if (splash) {
        splashMaterial = new NodeMaterial()
        splashMaterial.transparent = true
        splashMaterial.depthWrite = false
        splashMaterial.blending = THREE.AdditiveBlending
        splashMaterial.side = THREE.DoubleSide

        splashMaterial.vertexNode = Fn(() => {
          const aInitialPos = attribute<'vec3'>('aInitialPos', 'vec3')
          const aSpeed = attribute<'float'>('aSpeed', 'float')

          const { t, surfaceY, impact, landX, landZ } = dropNodes(aInitialPos, aSpeed)

          // Splash age in fall cycles. The modulo wraps the tail of a cycle past
          // the respawn, so a drop landing on the lowest ground - at the very end
          // of its fall - still gets a full splash.
          const age = mod(t.sub(impact), 1.0)
          const progress = saturate(age.div(max(uSplashWindow.mul(aSpeed), float(0.0001))))
          const size = uSplashSize.mul(float(0.35).add(progress.mul(0.65)))
          const center = vec3(landX, surfaceY.add(0.05), landZ)
          const worldPos = center.add(
            vec3(positionLocal.x.mul(size), 0.0, positionLocal.y.mul(size))
          )
          const clip = cameraProjectionMatrix.mul(modelViewMatrix.mul(vec4(worldPos, 1.0)))

          const fade = oneMinus(progress)
          vSplashFade.assign(fade.mul(fade))
          vSplashProgress.assign(progress)

          return clip
        })()

        // Fragment shader: expanding ripple ring plus a short-lived bright core
        splashMaterial.fragmentNode = Fn(() => {
          const dist = length(uv().sub(0.5).mul(2.0))
          const radius = mix(0.12, 0.9, vSplashProgress)
          const width = mix(0.22, 0.05, vSplashProgress)
          const ring = smoothstep(radius.sub(width), radius, dist).mul(
            oneMinus(smoothstep(radius, radius.add(width), dist))
          )
          const core = oneMinus(smoothstep(0.0, 0.45, dist)).mul(oneMinus(vSplashProgress))
          const alpha = ring
            .mul(0.9)
            .add(core.mul(0.5))
            .mul(vSplashFade)
            .mul(uOpacity)
          return vec4(uSplashColor.rgb, alpha)
        })()

        splashMesh = new THREE.Mesh(geometryRef, splashMaterial)
        splashMesh.name = 'RainSplash'
        splashMesh.frustumCulled = false
        scene.add(splashMesh)
      }

      // Use a dedicated requestAnimationFrame loop instead of addBeforeFrame to
      // avoid triggering the Scene's beforeFrame render path (which skips
      // renderer.clear() and background — problematic on WebGPU).
      const animate = () => {
        const uTimeRef = timeUniform
        if (uTimeRef) {
          ;(uTimeRef as { value: number }).value += 0.016 * speed
        }
        animationId = requestAnimationFrame(animate)
      }
      animationId = requestAnimationFrame(animate)

      // Keep a reference so the flat map is not tree-shaken away before cleanup.
      void flatMap
    }

    onMounted(create)
    onBeforeUnmount(destroy)

    watch(
      () => [
        props.count,
        props.color,
        props.speed,
        props.range,
        props.height,
        props.windX,
        props.windZ,
        props.opacity,
        props.heightMap,
        props.heightMapSize,
        props.heightMapAmplitude,
        props.groundHeight,
        props.splash,
        props.splashColor,
        props.splashSize,
        props.splashDuration
      ],
      create
    )
  },
  render() {
    return null
  }
})
