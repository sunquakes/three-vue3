import { defineComponent, onBeforeUnmount, onMounted, PropType, watch } from 'vue'
import * as THREE from 'three'
import { NodeMaterial } from 'three/webgpu'
import {
  Fn,
  uniform,
  float,
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
  sin,
  cos,
  min,
  max,
  mx_noise_float,
  texture,
  viewportSize
} from 'three/tsl'
import { useScene } from '../context/SceneContext'
import { SnowCover } from '../utils/SnowCover'

export default defineComponent({
  name: 'TvSnow',
  props: {
    count: {
      type: Number,
      default: 3000
    },
    color: {
      type: [String, Number, Object] as PropType<string | number | THREE.Color>,
      default: 0xffffff
    },
    speed: {
      type: Number,
      default: 0.5
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
      default: 0.2
    },
    windZ: {
      type: Number,
      default: 0.1
    },
    turbulence: {
      type: Number,
      default: 0.8
    },
    opacity: {
      type: Number,
      default: 0.9
    },
    size: {
      type: Number,
      default: 1
    },
    accumulate: {
      type: Boolean,
      default: false
    },
    accumulationTargets: {
      type: [Object, Array] as PropType<THREE.Object3D | THREE.Object3D[]>
    },
    accumulationThickness: {
      type: Number,
      default: 0.1
    },
    accumulationDuration: {
      type: Number,
      default: 6
    },
    accumulationColor: {
      type: [String, Number, Object] as PropType<string | number | THREE.Color>,
      default: 0xffffff
    }
  },
  setup(props) {
    const sceneContext = useScene()

    let mesh: THREE.Mesh | null = null
    let geometry: THREE.BufferGeometry | null = null
    let material: NodeMaterial | null = null
    let snowTexture: THREE.CanvasTexture | null = null
    let cover: SnowCover | null = null
    let timeUniform: ReturnType<typeof uniform> | null = null
    let animationId: number | null = null

    function destroy() {
      if (animationId !== null) {
        cancelAnimationFrame(animationId)
        animationId = null
      }
      cover?.dispose()
      cover = null
      const scene = sceneContext.scene
      if (mesh && scene) scene.remove(mesh)
      geometry?.dispose()
      material?.dispose()
      snowTexture?.dispose()
      mesh = null
      geometry = null
      material = null
      snowTexture = null
      timeUniform = null
    }

    function create() {
      destroy()

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
        turbulence,
        opacity,
        size,
        accumulate,
        accumulationTargets,
        accumulationThickness,
        accumulationDuration,
        accumulationColor
      } = props

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
      const phaseArr = new Float32Array(count * 4)
      const sizeArr = new Float32Array(count * 4)

      for (let i = 0; i < count; i++) {
        const x = (Math.random() - 0.5) * range
        const z = (Math.random() - 0.5) * range
        const y = Math.random()
        const particleSpeed = 0.3 + Math.random() * 0.7
        const phase = Math.random() * 6.28318
        const particleSize = Math.random()

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
          phaseArr[vIdx] = phase
          sizeArr[vIdx] = particleSize
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
      geometry.setAttribute('aPhase', new THREE.Float32BufferAttribute(phaseArr, 1))
      geometry.setAttribute('aSize', new THREE.Float32BufferAttribute(sizeArr, 1))
      geometry.setIndex(new THREE.BufferAttribute(indices, 1))
      const geometryRef = geometry

      // Hexagonal snowflake CanvasTexture
      const canvas = document.createElement('canvas')
      canvas.width = 128
      canvas.height = 128
      const ctx = canvas.getContext('2d')!

      ctx.clearRect(0, 0, 128, 128)

      const cx = 64
      const cy = 64
      const outerRadius = 56
      const innerRadius = 18

      // Soft luminous core. A flake is only a few pixels wide on screen, where
      // the crystal arms alone collapse into a single flickering pixel; the
      // glow keeps every flake readable as a bright dot and gives close flakes
      // a natural blur.
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 60)
      glow.addColorStop(0, 'rgba(255, 255, 255, 0.85)')
      glow.addColorStop(0.35, 'rgba(255, 255, 255, 0.32)')
      glow.addColorStop(0.7, 'rgba(255, 255, 255, 0.08)')
      glow.addColorStop(1, 'rgba(255, 255, 255, 0)')
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(cx, cy, 60, 0, Math.PI * 2)
      ctx.fill()

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)'
      ctx.lineWidth = 4
      ctx.lineCap = 'round'

      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3 - Math.PI / 2
        const cosVal = Math.cos(angle)
        const sinVal = Math.sin(angle)

        ctx.beginPath()
        ctx.moveTo(cx + innerRadius * cosVal, cy + innerRadius * sinVal)
        ctx.lineTo(cx + outerRadius * cosVal, cy + outerRadius * sinVal)
        ctx.stroke()

        const branchAngle1 = angle - Math.PI / 6
        const branchAngle2 = angle + Math.PI / 6
        const branchStart = outerRadius * 0.65
        const branchEnd = outerRadius * 0.9

        ctx.beginPath()
        ctx.moveTo(cx + branchStart * cosVal, cy + branchStart * sinVal)
        ctx.lineTo(cx + branchEnd * Math.cos(branchAngle1), cy + branchEnd * Math.sin(branchAngle1))
        ctx.stroke()

        ctx.beginPath()
        ctx.moveTo(cx + branchStart * cosVal, cy + branchStart * sinVal)
        ctx.lineTo(cx + branchEnd * Math.cos(branchAngle2), cy + branchEnd * Math.sin(branchAngle2))
        ctx.stroke()
      }

      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(cx, cy, 6, 0, Math.PI * 2)
      ctx.fill()

      snowTexture = new THREE.CanvasTexture(canvas)

      // TSL uniforms
      const uTime = uniform(0)
      const uRange = uniform(range)
      const uHeightRange = uniform(height)
      const uWindX = uniform(windX)
      const uWindZ = uniform(windZ)
      const uTurbulence = uniform(turbulence)
      const uColor = uniform(new THREE.Color(color))
      // Custom TSL materials go through a linear to sRGB conversion on WebGPU
      // final output (making colors brighter), while WebGL writes the raw value
      // directly, so pre-correct on WebGPU to make both backends match.
      if (renderer?.isWebGPURenderer === true) {
        const brightness = 0.86
        const { r, g, b } = uColor.value
        uColor.value.setRGB(
          Math.pow(r, 2.2) * brightness,
          Math.pow(g, 2.2) * brightness,
          Math.pow(b, 2.2) * brightness
        )
      }
      const uOpacity = uniform(opacity)
      // Sizes are authored in CSS pixels, so scale them to the renderer's
      // physical pixels to keep flakes looking the same on every display.
      const pixelRatio = renderer?.getPixelRatio?.() ?? 1
      timeUniform = uTime

      // vAlpha varying shared between vertex and fragment
      const vAlpha = varying(float(0))

      material = new NodeMaterial()
      material.transparent = true
      material.depthWrite = false
      material.blending = THREE.AdditiveBlending
      material.alphaTest = 0.01
      material.side = THREE.DoubleSide

      // Vertex shader: animate particle center with sway, billboard quad in clip space
      material.vertexNode = Fn(() => {
        const aInitialPos = attribute<'vec3'>('aInitialPos', 'vec3')
        const aSpeed = attribute<'float'>('aSpeed', 'float')
        const aPhase = attribute<'float'>('aPhase', 'float')
        const aSize = attribute<'float'>('aSize', 'float')

        // Elapsed fall time in "fall cycles" and the current cycle progress.
        const fallTime = uTime.mul(aSpeed).mul(0.15)
        const t = mod(aInitialPos.y.add(fallTime), 1.0)

        // Fine flutter keeps each flake alive inside the wind field.
        const sway = sin(uTime.mul(aSpeed).add(aPhase)).mul(0.18)
        const sway2 = cos(uTime.mul(aSpeed).mul(0.7).add(aPhase.mul(2.0))).mul(0.12)

        // Wind field: two drifting 3D noise samples give a spatially coherent
        // gust field, so neighbouring flakes are pushed together and the snow
        // travels in waves instead of an identical uniform drift.
        const fieldDrift = uTime.mul(0.16)
        const fieldA = mx_noise_float(
          vec3(
            aInitialPos.x.mul(0.17).add(fieldDrift),
            aInitialPos.y.mul(0.9),
            aInitialPos.z.mul(0.17)
          )
        )
        const fieldB = mx_noise_float(
          vec3(
            aInitialPos.x.mul(0.31).add(23.0),
            aInitialPos.y.mul(0.7).sub(fieldDrift.mul(0.7)),
            aInitialPos.z.mul(0.31).add(11.0)
          )
        )

        // Steady wind is integrated over the elapsed fall time instead of the
        // per-cycle progress, so a flake no longer snaps sideways every time it
        // wraps from the ground back up to the sky. The drifting noise fields
        // add the gusty, spatially coherent swirl on top of that drift.
        const drift = fallTime.mul(2.0)
        const unwrappedX = aInitialPos.x
          .add(uWindX.mul(drift))
          .add(fieldB.mul(uTurbulence))
          .add(sway)
        const unwrappedZ = aInitialPos.z
          .add(uWindZ.mul(drift))
          .add(fieldA.mul(uTurbulence))
          .add(sway2)

        // Wrap the drifting field back into the spawn volume, otherwise the
        // whole snowfall slowly blows out of the box and the scene empties.
        const halfRange = uRange.mul(0.5)
        const centerX = mod(unwrappedX.add(halfRange), uRange).sub(halfRange)
        const centerZ = mod(unwrappedZ.add(halfRange), uRange).sub(halfRange)
        const centerY = oneMinus(t)
          .mul(uHeightRange)
          .sub(uHeightRange.mul(0.5))
          .add(fieldB.mul(uTurbulence).mul(0.3))

        // View space center
        const centerView = modelViewMatrix.mul(vec4(centerX, centerY, centerZ, 1.0))
        // Clip space center
        const centerClip = cameraProjectionMatrix.mul(centerView)

        // Screen size in physical pixels. Perspective only shrinks distant
        // flakes (attenuation is capped at 1.0), so a flake never balloons as
        // it approaches the camera. The lower bound keeps far flakes off the
        // sub-pixel range, which used to shimmer and read as noise.
        const viewDepth = max(centerView.z.negate(), float(0.1))
        const baseSize = float(3.2)
          .add(aSize.mul(3.2))
          .mul(float(size))
          .mul(pixelRatio)
        const attenuation = min(float(9.0).div(viewDepth), float(1.0))
        const pointSize = max(baseSize.mul(attenuation), float(1.3).mul(pixelRatio))

        // Billboard offset in clip space: convert pixel size to NDC per axis,
        // then compensate for the perspective divide (multiply by clip w).
        const ndcSizeX = pointSize.div(viewportSize.x.div(2.0))
        const ndcSizeY = pointSize.div(viewportSize.y.div(2.0))
        const offsetX = positionLocal.x.mul(ndcSizeX).mul(centerClip.w)
        const offsetY = positionLocal.y.mul(ndcSizeY).mul(centerClip.w)

        // Fade flakes in as they spawn at the top and out as they melt at the
        // bottom; smaller flakes are also a little dimmer, which adds depth.
        const fadeIn = smoothstep(float(0.0), float(0.06), t)
        const fadeOut = oneMinus(smoothstep(float(0.93), float(1.0), t))
        vAlpha.assign(fadeIn.mul(fadeOut).mul(float(0.55).add(aSize.mul(0.45))))

        return vec4(centerClip.x.add(offsetX), centerClip.y.add(offsetY), centerClip.z, centerClip.w)
      })()

      // Fragment shader: sample snowflake texture using UV coordinates
      material.fragmentNode = Fn(() => {
        const texColor = texture(snowTexture!, uv())
        const alpha = texColor.a.mul(vAlpha).mul(uOpacity)
        return vec4(uColor.rgb.mul(texColor.rgb), alpha)
      })()

      mesh = new THREE.Mesh(geometryRef, material)
      mesh.name = 'Snow'
      mesh.frustumCulled = false
      scene.add(mesh)

      // Snow settles on the surrounding scene meshes: a shell is added to every
      // eligible surface and grows to its final thickness over
      // `accumulationDuration` seconds, then stays put.
      if (accumulate) {
        cover = new SnowCover({
          scene,
          targets: accumulationTargets,
          thickness: accumulationThickness,
          duration: accumulationDuration,
          color: accumulationColor,
          renderer
        })
      }

      // Use a dedicated requestAnimationFrame loop instead of addBeforeFrame to
      // avoid triggering the Scene's beforeFrame render path (which skips
      // renderer.clear() and background — problematic on WebGPU).
      let lastTime = performance.now()
      const animate = (now = performance.now()) => {
        const uTimeRef = timeUniform
        if (uTimeRef) {
          ;(uTimeRef as { value: number }).value += 0.016 * speed
        }
        // The cover advances in real seconds so its growth does not depend on
        // the snowfall speed or on the frame rate.
        const delta = Math.min(Math.max((now - lastTime) / 1000, 0), 0.1)
        lastTime = now
        cover?.update(delta)
        animationId = requestAnimationFrame(animate)
      }
      animationId = requestAnimationFrame(animate)
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
        props.turbulence,
        props.opacity,
        props.size,
        props.accumulate,
        props.accumulationTargets,
        props.accumulationThickness,
        props.accumulationDuration,
        props.accumulationColor
      ],
      create
    )
  },
  render() {
    return null
  }
})
