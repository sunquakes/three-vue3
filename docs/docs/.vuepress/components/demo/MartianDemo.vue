<!--
  Port of the r3l `ComplexSceneDemo`: the Martian dune plain, the Perseverance
  rover driving its serpentine survey route, the crater-rim station, the DSN
  relay and the signal pulses. Everything is built inside `<tv-scene>`; nothing
  is allocated at module scope so the docs site can still be pre-rendered.
-->
<template>
  <tv-height-fog
    fog-color="#b5724a"
    :fog-density="0.016"
    :fog-height="7"
    :fog-height-falloff="0.4"
    :fog-max-opacity="0.55"
    :noise-strength="0.5"
    :noise-scale="0.018"
    :noise-speed-x="0.05"
    :noise-speed-z="0.02"
    inscattering-color="#ffb27a"
    :inscattering-intensity="1"
  />
  <tv-snow
    :count="9000"
    color="#d9a37a"
    :speed="0.42"
    :range="70"
    :height="24"
    :wind-x="1.5"
    :wind-z="0.6"
    :opacity="0.34"
  />
</template>

<script setup lang="ts">
import * as THREE from 'three'
import { HemisphereLight, NodeMaterial, PointLight } from 'three/webgpu'
import {
  Fn,
  cameraProjectionMatrix,
  float,
  length,
  modelViewMatrix,
  mx_noise_float,
  positionLocal,
  smoothstep,
  varying,
  vec2,
  vec3,
  vec4
} from 'three/tsl'
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { onBeforeUnmount, onMounted } from 'vue'
import {
  GLTFLoader,
  GlowSprite,
  Popup,
  RadarSweep,
  SignalWave,
  SkyDome,
  SweepLight,
  disposeModel,
  globalParameterBus,
  useFrame,
  useScene
} from 'three-vue3'
import SpecimenLoupe from './SpecimenLoupe.vue'

interface MartianCaptions {
  intro: string
  survey: string
  driving: string
  parked: string
  acquiring: string
  finding: string
  downlink: string
}

interface SceneParts {
  camera?: THREE.Camera
  light?: THREE.Object3D
  controls?: unknown
}

const props = defineProps<{
  captions: MartianCaptions
}>()

const emit = defineEmits<{
  (event: 'caption', text: string): void
  (event: 'caption-opacity', opacity: number): void
  (event: 'pip-opacity', opacity: number): void
}>()

// Scene layout, all derived from the story.
const CRATER = { x: -1.5, z: -23, radius: 10.5, depth: 3, rim: 1 }
const ROVER = { x: 1.8, z: -10.4 }
const STATION = { x: -7.6, z: -11.2 }
const LANDER = { x: -76, z: -52 }
const LANDER_HEIGHT = 9
const PLANT = { x: -3.3, z: -12.6 }
const PLANT_WIDTH = 2.2
const SUN_DIRECTION: [number, number, number] = [-0.78, 0.2, -0.6]
const EARTH_DIRECTION: [number, number, number] = [-0.442, 0.241, -0.864]
const EARTH_DISTANCE = 150

const SIGNAL_RING_COUNT = 7
const SIGNAL_PULSE_START = 0.55
const SIGNAL_PULSE_END = 4.6
const SIGNAL_TRAVEL = 30
const SIGNAL_SPEED = 9

const MAST_SPREAD_DELAY = 400
const MAST_SPREAD_DURATION = 2200
const MAST_SPREAD_ANGLE = 1.15

// The six drive wheels of Perseverance, in the model's local space.
const WHEEL_CENTERS: Array<[number, number, number]> = [
  [-1.144, -0.0003, -1.13],
  [-1.266, 0.0001, -0.055],
  [-1.144, -0.0003, 1.13],
  [1.144, 0.0005, -1.13],
  [1.266, 0.0001, -0.055],
  [1.144, -0.0003, 1.13]
]
const WHEEL_RADIUS = 0.231

const DRIVE_POINTS: Array<[number, number]> = [
  [12.5, -4.4],
  [9.8, -1.9],
  [6.2, 0.1],
  [2.0, 0.5],
  [-2.2, -0.2],
  [-5.8, -1.9],
  [-7.4, -4.6],
  [-7.2, -7.2],
  [-4.4, -8.5],
  [-0.9, -7.8],
  [2.8, -6.5],
  [5.2, -8.5],
  [3.1, -10.2],
  [1.8, -10.4]
]
const DRIVE_SPEED = 1.1
const DRIVE_WAYPOINTS = 60
const DRIVE_STOPS: Array<{ t: number; dwell: number }> = [
  { t: 0.31, dwell: 2400 },
  { t: 0.6, dwell: 2400 }
]
const SURVEY_HEADING = -1.62
const SCAN_RADIUS = 7
const SCAN_PERIOD = 2.6

const TRACK_MAX_SAMPLES = 1024
const TRACK_SAMPLE_STEP = 0.1
const TRACK_Y_OFFSET = 0.05
const TRACK_GRAIN_TILES = 3

// Beyond the playable plain the ground sags away like a very large sphere.
function terrainCurvature(x: number, z: number): number {
  const beyond = Math.max(0, Math.hypot(x, z) - 150)
  return -(beyond * beyond) / 2000
}

// Shared crest line so the height field and the ground shading agree.
function duneCrest(x: number, z: number): number {
  const phase = Math.sin(x * 0.075 - z * 0.04 + Math.sin(z * 0.03) * 1.6)
  return Math.sign(phase) * Math.pow(Math.abs(phase), 1.5)
}

function terrainHeight(x: number, z: number): number {
  const duneNoise =
    duneCrest(x, z) * 1.05 +
    Math.sin((x + z) * 0.115 + 0.6) * 0.3 +
    Math.sin(x * 0.19 - z * 0.13 + 2.1) * 0.12
  const flattenNearRover = THREE.MathUtils.smoothstep(Math.hypot(x - ROVER.x, z - ROVER.z), 3.2, 12)
  const flattenNearLander = THREE.MathUtils.smoothstep(
    Math.hypot(x - LANDER.x, z - LANDER.z),
    6,
    22
  )
  const dunes = duneNoise * flattenNearRover * flattenNearLander

  const distance = Math.hypot(x - CRATER.x, z - CRATER.z)
  const t = distance / CRATER.radius
  const bowl = t < 1 ? -CRATER.depth * Math.pow(1 - t * t, 1.35) : 0
  const rim = CRATER.rim * Math.exp(-Math.pow((t - 1) / 0.2, 2))

  return dunes + bowl + rim + terrainCurvature(x, z)
}

function createRandom(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

// Ground detail map: sand grain, wind streaks and embedded grit.
function createRegolithTexture(): THREE.CanvasTexture | null {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (!context) return null

  const random = createRandom(48271)

  const grain = context.createImageData(size, size)
  for (let i = 0; i < grain.data.length; i += 4) {
    const value = 210 + random() * 45
    grain.data[i] = value
    grain.data[i + 1] = value * 0.95
    grain.data[i + 2] = value * 0.89
    grain.data[i + 3] = 255
  }
  context.putImageData(grain, 0, 0)

  for (let i = 0; i < 220; i += 1) {
    const light = random() > 0.45
    const x = random() * size
    const y = random() * size
    const streakLength = 40 + random() * 220
    const alpha = (0.03 + random() * 0.05).toFixed(3)
    context.strokeStyle = light ? `rgba(255, 240, 218, ${alpha})` : `rgba(94, 50, 32, ${alpha})`
    context.lineWidth = 0.6 + random() * 2.2
    for (const offsetX of [0, -size]) {
      for (const offsetY of [0, -size]) {
        context.beginPath()
        context.moveTo(x + offsetX, y + offsetY)
        context.lineTo(x + offsetX + streakLength, y + offsetY + streakLength * 0.35)
        context.stroke()
      }
    }
  }

  for (let i = 0; i < 30; i += 1) {
    const originX = random() * size
    const originY = random() * size
    const gap = 5 + random() * 7
    const bend = 1.2 + random() * 2.6
    const rippleLength = 60 + random() * 140
    const phase = random() * Math.PI * 2
    const lines = 3 + Math.floor(random() * 4)
    for (let k = 0; k < lines; k += 1) {
      context.strokeStyle = k % 2 === 0 ? 'rgba(255, 240, 218, 0.22)' : 'rgba(84, 44, 26, 0.22)'
      context.lineWidth = 1 + random() * 0.8
      for (const offsetX of [0, -size]) {
        for (const offsetY of [0, -size]) {
          context.beginPath()
          for (let step = 0; step <= 10; step += 1) {
            const progress = step / 10
            const px = originX + offsetX + progress * rippleLength
            const py = originY + offsetY + k * gap + Math.sin(progress * Math.PI * 2 + phase) * bend
            if (step === 0) context.moveTo(px, py)
            else context.lineTo(px, py)
          }
          context.stroke()
        }
      }
    }
  }

  for (let i = 0; i < 900; i += 1) {
    const radius = 0.4 + random() * 1.3
    context.fillStyle = random() > 0.5 ? 'rgba(255, 236, 208, 0.2)' : 'rgba(84, 42, 26, 0.28)'
    context.beginPath()
    context.arc(random() * size, random() * size, radius, 0, Math.PI * 2)
    context.fill()
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

// Wheel ruts are pressed regolith with their own grain and soft shoulders.
function createRutTexture(): THREE.CanvasTexture | null {
  const width = 96
  const height = 192
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) return null

  const random = createRandom(72931)
  const image = context.createImageData(width, height)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4
      const across = Math.abs((x + 0.5) / width - 0.5) * 2
      const grain = random()
      const edge = 1 - THREE.MathUtils.smoothstep(across, 0.78, 1)
      const shade = 0.78 + grain * 0.22
      image.data[index] = shade * 255
      image.data[index + 1] = shade * 255
      image.data[index + 2] = shade * 255
      image.data[index + 3] = edge * (0.7 + grain * 0.3) * 255
    }
  }
  context.putImageData(image, 0, 0)

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

function disposeMaterial(material: THREE.Material) {
  for (const value of Object.values(material)) {
    const texture = value as THREE.Texture | null
    if (texture && (texture as THREE.Texture).isTexture) texture.dispose()
  }
  material.dispose()
}

function disposeObject(root: THREE.Object3D) {
  root.traverse((child) => {
    const node = child as THREE.Object3D & {
      geometry?: THREE.BufferGeometry
      material?: THREE.Material | THREE.Material[]
    }
    if ((node as THREE.InstancedMesh).isInstancedMesh) {
      ;(node as THREE.InstancedMesh).dispose()
    }
    if (node.geometry) node.geometry.dispose()
    const material = node.material
    if (Array.isArray(material)) material.forEach(disposeMaterial)
    else if (material) disposeMaterial(material)
  })
}

// Eroded mesa spun from a lathe profile, with gullies and strata colours.
function createMassif(height: number, radius: number, seed: number, material: THREE.Material) {
  const control: Array<[number, number]> = [
    [1.3, 0],
    [1.04, 0.07],
    [0.9, 0.17],
    [0.86, 0.33],
    [0.82, 0.45],
    [0.88, 0.51],
    [0.84, 0.65],
    [0.8, 0.77],
    [0.82, 0.84],
    [0.74, 0.92],
    [0.56, 0.97],
    [0, 1]
  ]
  const radiusAt = (t: number) => {
    for (let i = 1; i < control.length; i += 1) {
      const [r1, t1] = control[i]
      if (t <= t1) {
        const [r0, t0] = control[i - 1]
        const k = (t - t0) / Math.max(t1 - t0, 1e-5)
        return r0 + (r1 - r0) * k
      }
    }
    return 0
  }

  const steps = 48
  const points: THREE.Vector2[] = []
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps
    points.push(new THREE.Vector2(Math.max(radiusAt(t) * radius, 0.001), t * height))
  }

  const geometry = new THREE.LatheGeometry(points, 128)
  const position = geometry.attributes.position as THREE.BufferAttribute
  const strataDark = new THREE.Color(0x3d1d13)
  const strataLit = new THREE.Color(0x7b3c26)
  const dustCap = new THREE.Color(0xb26b45)
  const colors = new Float32Array(position.count * 3)
  const color = new THREE.Color()

  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i)
    const z = position.getZ(i)
    const py = position.getY(i)
    const angle = Math.atan2(z, x)
    const t = THREE.MathUtils.clamp(py / height, 0, 1)

    const ridge =
      Math.sin(angle * 4 + seed) * 0.55 +
      Math.sin(angle * 9 - seed * 1.7) * 0.3 +
      Math.sin(angle * 19 + seed * 0.4) * 0.15
    const reach = Math.max(1 + ridge * (0.2 - t * 0.13), 0.55)
    const notch = t > 0.8 ? (t - 0.8) * 0.25 * height * (0.35 + Math.abs(ridge)) : 0

    position.setX(i, x * reach)
    position.setZ(i, z * reach)
    position.setY(i, py - notch)

    const band = 0.5 + 0.5 * Math.sin(py * 1.9 + seed * 2.6)
    color.copy(strataDark).lerp(strataLit, band * 0.8)
    color.lerp(dustCap, THREE.MathUtils.smoothstep(t, 0.7, 0.97) * 0.75)
    color.multiplyScalar(0.9 + ridge * 0.1)
    color.toArray(colors, i * 3)
  }

  position.needsUpdate = true
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  return new THREE.Mesh(geometry, material)
}

// The engine's burn scar: a ring displaced onto the dunes, broken up by TSL noise.
function createBurnScar(cx: number, cz: number, inner: number, outer: number) {
  const scorchGeometry = new THREE.RingGeometry(inner, outer, 64, 8)
  scorchGeometry.rotateX(-Math.PI / 2)
  const baseY = terrainHeight(cx, cz) - 0.12
  const scorchPositions = scorchGeometry.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < scorchPositions.count; i += 1) {
    const x = scorchPositions.getX(i)
    const z = scorchPositions.getZ(i)
    scorchPositions.setY(i, terrainHeight(cx + x, cz + z) - baseY + 0.035)
  }
  scorchPositions.needsUpdate = true

  const scorchMaterial = new NodeMaterial()
  scorchMaterial.transparent = true
  scorchMaterial.depthWrite = false
  scorchMaterial.fog = false

  const vScorch = varying(vec2(0, 0))
  scorchMaterial.vertexNode = Fn(() => {
    vScorch.assign(positionLocal.xz)
    return cameraProjectionMatrix.mul(modelViewMatrix).mul(vec4(positionLocal, 1.0))
  })()
  scorchMaterial.fragmentNode = Fn(() => {
    const radius = length(vScorch)
    const band = smoothstep(inner * 0.735, inner * 1.33, radius).mul(
      float(1.0).sub(smoothstep(outer * 0.735, outer, radius))
    )
    const ash = mx_noise_float(vec3(vScorch.mul(4.0), float(0.0)))
      .mul(0.5)
      .add(0.5)
    const intensity = band.mul(ash.mul(0.6).add(0.55))
    return vec4(vec3(0.1, 0.045, 0.03), intensity.mul(0.62))
  })()

  const scorch = new THREE.Mesh(scorchGeometry, scorchMaterial)
  scorch.renderOrder = 1
  scorch.position.set(cx, baseY, cz)
  return scorch
}

// Re-bucket the single "Wheels_objs" primitive into six axle pivots.
function splitWheels(wheelsGroup: THREE.Object3D, wheelCenters: THREE.Vector3[]) {
  const pivots = wheelCenters.map((center) => {
    const pivot = new THREE.Group()
    pivot.position.copy(center)
    return pivot
  })

  const primitiveMeshes: THREE.Mesh[] = []
  wheelsGroup.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (mesh.isMesh && mesh.geometry) primitiveMeshes.push(mesh)
  })

  for (const mesh of primitiveMeshes) {
    const indexed = mesh.geometry as THREE.BufferGeometry
    const source = indexed.index ? indexed.toNonIndexed() : indexed
    const position = source.attributes.position as THREE.BufferAttribute
    const normal = source.attributes.normal as THREE.BufferAttribute | undefined
    const uv = source.attributes.uv as THREE.BufferAttribute | undefined

    const triangleBuckets: number[][] = [[], [], [], [], [], []]
    const centroid = new THREE.Vector3()
    for (let i = 0; i < position.count; i += 3) {
      centroid.set(
        (position.getX(i) + position.getX(i + 1) + position.getX(i + 2)) / 3,
        (position.getY(i) + position.getY(i + 1) + position.getY(i + 2)) / 3,
        (position.getZ(i) + position.getZ(i + 1) + position.getZ(i + 2)) / 3
      )
      let best = 0
      let bestDistance = Infinity
      for (let w = 0; w < wheelCenters.length; w += 1) {
        const distance = centroid.distanceToSquared(wheelCenters[w])
        if (distance < bestDistance) {
          bestDistance = distance
          best = w
        }
      }
      triangleBuckets[best].push(i, i + 1, i + 2)
    }

    for (let w = 0; w < wheelCenters.length; w += 1) {
      const vertexIndices = triangleBuckets[w]
      if (vertexIndices.length === 0) continue

      const positions = new Float32Array(vertexIndices.length * 3)
      const normals = normal ? new Float32Array(vertexIndices.length * 3) : null
      const uvs = uv ? new Float32Array(vertexIndices.length * 2) : null
      const center = wheelCenters[w]

      for (let k = 0; k < vertexIndices.length; k += 1) {
        const vi = vertexIndices[k]
        positions[k * 3] = position.getX(vi) - center.x
        positions[k * 3 + 1] = position.getY(vi) - center.y
        positions[k * 3 + 2] = position.getZ(vi) - center.z
        if (normals && normal) {
          normals[k * 3] = normal.getX(vi)
          normals[k * 3 + 1] = normal.getY(vi)
          normals[k * 3 + 2] = normal.getZ(vi)
        }
        if (uvs && uv) {
          uvs[k * 2] = uv.getX(vi)
          uvs[k * 2 + 1] = uv.getY(vi)
        }
      }

      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      if (normals) geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
      if (uvs) geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))

      pivots[w].add(new THREE.Mesh(geometry, mesh.material))
    }

    if (source !== indexed) source.dispose()
    indexed.dispose()
  }

  return pivots
}

interface DriveWaypoint {
  x: number
  z: number
  at: number
  duration: number
}

interface DriveStop {
  at: number
  duration: number
}

interface Tween {
  fromX: number
  fromZ: number
  toX: number
  toZ: number
  startedAt: number
  duration: number
}

interface DriveState {
  roverGroup: THREE.Group
  waypoints: DriveWaypoint[]
  stops: DriveStop[]
  index: number
  ready: boolean
  endTime: number
  arrived: boolean
  held: boolean
  arriveTime: number
  arrivalHeading: number
  head: THREE.Object3D | null
  headBaseY: number
  sweep: SweepLight | null
  wheels: THREE.Group[]
  wheelWorldRadius: number
  wheelHalfWidths: number[]
  tween: Tween | null
  paused: boolean
  pausedElapsed: number
}

interface TrackStrip {
  geometry: THREE.BufferGeometry
  positions: Float32Array
  uvs: Float32Array
  count: number
  lastX: number
  lastZ: number
  distance: number
}

interface RoverTrack {
  strips: TrackStrip[]
  meshes: THREE.Mesh[]
  material: THREE.Material
}

const sceneSlotProps = useScene()

let disposed = false
let previousTime: number | null = null
let lastCaption = ''
let lastCaptionOpacity = -1
let lastPipOpacity = -1
let lastLoupeOpacity = 0

const extras: THREE.Object3D[] = []
const loadedModels: THREE.Object3D[] = []

let scene: THREE.Scene | null = null
let drive: DriveState | null = null
let track: RoverTrack | null = null
let scan: RadarSweep | null = null
let signalWaves: SignalWave | null = null
let linkLight: PointLight | null = null
let plant: THREE.Group | null = null
let loupe: Popup | null = null
let roverModel: THREE.Object3D | null = null
let skyDome: SkyDome | null = null
const wheelProbe = new THREE.Vector3()

// The library has no `Movable`, so the same move/pause/resume behaviour is
// inlined: the tween owns X/Z and the heading, terrain following owns Y.
function moveTo(state: DriveState, x: number, z: number, duration: number) {
  const group = state.roverGroup
  state.tween = {
    fromX: group.position.x,
    fromZ: group.position.z,
    toX: x,
    toZ: z,
    startedAt: performance.now(),
    duration: Math.max(duration, 1)
  }
  state.paused = false
}

function pauseDrive(state: DriveState) {
  if (!state.tween || state.paused) return
  state.pausedElapsed = performance.now() - state.tween.startedAt
  state.paused = true
}

function resumeDrive(state: DriveState) {
  if (!state.tween || !state.paused) return
  state.tween.startedAt = performance.now() - state.pausedElapsed
  state.paused = false
}

function updateMove(state: DriveState, now: number, dt: number) {
  const tween = state.tween
  if (!tween || state.paused) return
  const t = THREE.MathUtils.clamp((now - tween.startedAt) / tween.duration, 0, 1)
  const group = state.roverGroup
  group.position.x = THREE.MathUtils.lerp(tween.fromX, tween.toX, t)
  group.position.z = THREE.MathUtils.lerp(tween.fromZ, tween.toZ, t)

  const targetHeading = Math.atan2(tween.toX - tween.fromX, tween.toZ - tween.fromZ)
  const delta = Math.atan2(
    Math.sin(targetHeading - group.rotation.y),
    Math.cos(targetHeading - group.rotation.y)
  )
  group.rotation.y += delta * (1 - Math.exp(-dt * 8))
}

// Lays one narrow rut quad under every wheel at the rover's current pose.
function appendTrackSample(state: DriveState) {
  const roverTrack = track
  if (!roverTrack || state.wheels.length === 0) return
  if (roverTrack.strips.every((strip) => strip.count >= TRACK_MAX_SAMPLES)) return

  const heading = state.roverGroup.rotation.y
  const rightX = Math.cos(heading)
  const rightZ = -Math.sin(heading)

  state.wheels.forEach((wheel, index) => {
    const strip = roverTrack.strips[index]
    if (!strip || strip.count >= TRACK_MAX_SAMPLES) return

    wheel.getWorldPosition(wheelProbe)
    const x = wheelProbe.x
    const z = wheelProbe.z
    const step = Math.hypot(x - strip.lastX, z - strip.lastZ)
    if (Number.isFinite(strip.lastX) && step < TRACK_SAMPLE_STEP) return
    strip.lastX = x
    strip.lastZ = z
    if (Number.isFinite(step)) strip.distance += step

    const halfWidth = state.wheelHalfWidths[index] ?? state.wheelWorldRadius * 0.55
    const innerX = x - rightX * halfWidth
    const innerZ = z - rightZ * halfWidth
    const outerX = x + rightX * halfWidth
    const outerZ = z + rightZ * halfWidth
    const writeAt = strip.count * 2 * 3
    const uvAt = strip.count * 2 * 2

    strip.positions[writeAt] = innerX
    strip.positions[writeAt + 1] = terrainHeight(innerX, innerZ) + TRACK_Y_OFFSET
    strip.positions[writeAt + 2] = innerZ
    strip.positions[writeAt + 3] = outerX
    strip.positions[writeAt + 4] = terrainHeight(outerX, outerZ) + TRACK_Y_OFFSET
    strip.positions[writeAt + 5] = outerZ

    const grain = strip.distance * TRACK_GRAIN_TILES
    strip.uvs[uvAt] = 0
    strip.uvs[uvAt + 1] = grain
    strip.uvs[uvAt + 2] = 1
    strip.uvs[uvAt + 3] = grain

    const position = strip.geometry.getAttribute('position') as THREE.BufferAttribute
    position.needsUpdate = true
    const uv = strip.geometry.getAttribute('uv') as THREE.BufferAttribute
    uv.needsUpdate = true

    strip.count += 1
    strip.geometry.setDrawRange(0, (strip.count - 1) * 6)
  })
}

function emitCaption(text: string) {
  if (text === lastCaption) return
  lastCaption = text
  emit('caption', text)
}

function emitCaptionOpacity(opacity: number) {
  if (opacity === lastCaptionOpacity) return
  lastCaptionOpacity = opacity
  emit('caption-opacity', opacity)
}

function emitPipOpacity(opacity: number) {
  if (opacity === lastPipOpacity) return
  lastPipOpacity = opacity
  emit('pip-opacity', opacity)
}

// Narrative controller: dispatches drive waypoints, follows the terrain,
// pivots the rover into its survey pose, then lights the downlink.
function handleFrame() {
  if (disposed) return
  const now = performance.now()
  const dt = previousTime === null ? 0 : Math.min((now - previousTime) / 1000, 0.05)
  previousTime = now

  const state = drive
  let speedFactor = 0
  let activeStop: DriveStop | null = null

  if (state && state.ready) {
    for (const stop of state.stops) {
      if (now >= stop.at && now < stop.at + stop.duration) {
        activeStop = stop
        break
      }
    }
    const dwelling = activeStop !== null

    if (dwelling !== state.held) {
      state.held = dwelling
      if (dwelling) pauseDrive(state)
      else resumeDrive(state)
    }

    if (
      !dwelling &&
      state.index < state.waypoints.length &&
      now >= state.waypoints[state.index].at
    ) {
      const waypoint = state.waypoints[state.index]
      moveTo(state, waypoint.x, waypoint.z, waypoint.duration)
      state.index += 1
    }

    if (!state.arrived && now >= state.endTime) {
      state.arrived = true
      state.arriveTime = now
      state.arrivalHeading = state.roverGroup.rotation.y
      pauseDrive(state)
      const park = state.waypoints[state.waypoints.length - 1]
      if (park) {
        state.roverGroup.position.x = park.x
        state.roverGroup.position.z = park.z
      }
      state.index = state.waypoints.length
    }

    if (state.arrived) {
      speedFactor = 1 - THREE.MathUtils.smoothstep(now - state.arriveTime, 0, 1200)
    } else {
      speedFactor = dwelling ? 0 : 1
    }

    updateMove(state, now, dt)

    const group = state.roverGroup
    const groundY = terrainHeight(group.position.x, group.position.z)
    group.position.y = groundY + Math.sin(now / 85) * 0.02 * speedFactor

    const forwardX = Math.sin(group.rotation.y)
    const forwardZ = Math.cos(group.rotation.y)
    const hAhead = terrainHeight(
      group.position.x + forwardX * 1.1,
      group.position.z + forwardZ * 1.1
    )
    const hBehind = terrainHeight(
      group.position.x - forwardX * 1.1,
      group.position.z - forwardZ * 1.1
    )
    const targetPitch = THREE.MathUtils.clamp((hBehind - hAhead) / 2.2, -0.13, 0.13) * speedFactor
    group.rotation.x = THREE.MathUtils.lerp(group.rotation.x, targetPitch, 0.08)

    if (state.arrived) {
      const pivot = THREE.MathUtils.smoothstep(now - state.arriveTime - 400, 0, 2400)
      let headingDelta = SURVEY_HEADING - state.arrivalHeading
      headingDelta = Math.atan2(Math.sin(headingDelta), Math.cos(headingDelta))
      group.rotation.y = state.arrivalHeading + headingDelta * pivot
    }

    appendTrackSample(state)

    if (state.head) {
      if (state.arrived) {
        const spreadT = THREE.MathUtils.clamp(
          (now - state.arriveTime - MAST_SPREAD_DELAY) / MAST_SPREAD_DURATION,
          0,
          1
        )
        const spread = Math.sin(Math.PI * spreadT) * MAST_SPREAD_ANGLE
        const sweepScan = THREE.MathUtils.smoothstep(now - state.arriveTime - 2600, 0, 1200)
        state.head.rotation.y = state.headBaseY + spread + Math.sin(now / 1700) * 0.55 * sweepScan
      } else if (dwelling) {
        state.head.rotation.y = state.headBaseY + Math.sin(now / 950) * 0.42
      } else {
        state.head.rotation.y = THREE.MathUtils.lerp(state.head.rotation.y, state.headBaseY, 0.05)
      }
    }

    const sweeping =
      dwelling || (state.arrived && now >= state.arriveTime + 1200 && now < state.arriveTime + 7000)
    if (sweeping && !state.sweep && group.children.length > 0) {
      state.sweep = new SweepLight(group, {
        color: 0x6fe6ff,
        speed: 0.6,
        width: 0.25,
        intensity: 1.1,
        direction: 2,
        loop: THREE.LoopPingPong
      })
    }
    if (!sweeping && state.sweep) {
      state.sweep.dispose()
      state.sweep = null
    }

    if (activeStop && !scan) {
      scan = new RadarSweep({
        radius: SCAN_RADIUS,
        heightAt: terrainHeight,
        period: SCAN_PERIOD,
        color: 0x6fdcff,
        opacity: 0.85
      })
      scan.position.set(group.position.x, groundY, group.position.z)
      scene?.add(scan)
    } else if (!activeStop && scan) {
      scan.parent?.remove(scan)
      scan.dispose()
      scan = null
    }

    if (state.wheels.length > 0 && state.index > 0 && !state.arrived && !dwelling) {
      const roll = ((DRIVE_SPEED * speedFactor) / state.wheelWorldRadius) * dt
      if (roll !== 0) {
        for (const wheel of state.wheels) wheel.rotation.x += roll
      }
    }
  }

  const reveal =
    state && state.arrived ? THREE.MathUtils.smoothstep(now - state.arriveTime - 1600, 0, 1800) : 0
  const pulse = 0.5 + 0.5 * Math.sin(now / 260)

  if (linkLight) {
    linkLight.intensity = (7 + pulse * 5) * reveal
  }
  if (plant) {
    plant.scale.setScalar(0.45 + 0.55 * THREE.MathUtils.smoothstep(reveal, 0.45, 0.95))
  }
  if (loupe?.scene) {
    const opacity = THREE.MathUtils.smoothstep(reveal, 0.62, 0.95)
    if (Math.abs(opacity - lastLoupeOpacity) > 0.004) {
      lastLoupeOpacity = opacity
      loupe.scene.element.style.opacity = String(opacity)
    }
  }
  if (signalWaves) {
    if (state) {
      signalWaves.setOrigin(
        state.roverGroup.position.x,
        state.roverGroup.position.y + 1.7,
        state.roverGroup.position.z
      )
    }
    signalWaves.visible = reveal >= 0.55
  }

  let caption = props.captions.intro
  let captionOpacity = 1
  let targetPipOpacity = 0

  if (state && state.ready) {
    if (!state.arrived) {
      caption = activeStop ? props.captions.survey : props.captions.driving
    } else if (now - state.arriveTime < 2600) {
      caption = props.captions.parked
    } else if (reveal < 0.55) {
      caption = props.captions.acquiring
    } else if (reveal < 0.85) {
      caption = props.captions.finding
    } else {
      caption = props.captions.downlink
      captionOpacity = 0.95
      targetPipOpacity = 1
    }
  }

  emitCaption(caption)
  emitCaptionOpacity(captionOpacity)
  emitPipOpacity(targetPipOpacity)
}

useFrame(handleFrame, 'before')

function setupScene(sceneRef: THREE.Scene, parts: SceneParts) {
  scene = sceneRef
  const sunDirection = new THREE.Vector3(...SUN_DIRECTION).normalize()
  const earthDirection = new THREE.Vector3(...EARTH_DIRECTION).normalize()
  const wheelCenters = WHEEL_CENTERS.map(([x, y, z]) => new THREE.Vector3(x, y, z))
  const drivePoints = DRIVE_POINTS.map(([x, z]) => new THREE.Vector3(x, 0, z))
  const driveCurve = new THREE.CurvePath<THREE.Vector3>()
  for (let i = 1; i < drivePoints.length; i += 1) {
    driveCurve.add(new THREE.LineCurve3(drivePoints[i - 1], drivePoints[i]))
  }
  const driveStart = drivePoints[0]

  globalParameterBus.set('sunDirection', sunDirection)

  const camera = parts.camera
  if (camera) {
    camera.position.set(14, 6.5, 9)
    camera.lookAt(-2, 0.9, -12.5)
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = 75
      camera.far = 1000
      camera.updateProjectionMatrix()
    }
  }

  const controls = parts.controls as OrbitControls | undefined
  if (controls && 'target' in controls) {
    controls.target.set(-2, 0.9, -12.5)
    controls.enableDamping = true
    controls.dampingFactor = 0.06
    controls.enablePan = false
    controls.autoRotate = true
    controls.autoRotateSpeed = 0.3
    controls.minDistance = 10
    controls.maxDistance = 60
    controls.minPolarAngle = 0.35
    controls.maxPolarAngle = Math.PI * 0.48
    controls.update()
  }

  parts.light?.traverse((child) => {
    const lightChild = child as THREE.Light
    if (!lightChild.isLight) return
    if ((lightChild as THREE.DirectionalLight).isDirectionalLight) {
      const directional = lightChild as THREE.DirectionalLight
      directional.position.copy(sunDirection).multiplyScalar(60)
      directional.color.set('#ffb27a')
      directional.intensity = 2.8
    } else if ((lightChild as THREE.AmbientLight).isAmbientLight) {
      lightChild.intensity = 0.3
    }
  })

  const hemisphere = new HemisphereLight(0x8a3f26, 0x180c09, 0.95)
  sceneRef.add(hemisphere)
  extras.push(hemisphere)

  skyDome = new SkyDome({ radius: 900 })
  sceneRef.add(skyDome)
  extras.push(skyDome)

  // --- Terrain: dust plain with the impact crater -------------------------
  const terrainGeometry = new THREE.PlaneGeometry(1100, 1100, 512, 512)
  terrainGeometry.rotateX(-Math.PI / 2)
  const positions = terrainGeometry.attributes.position as THREE.BufferAttribute
  const colors = new Float32Array(positions.count * 3)
  const lowColor = new THREE.Color('#4a1d13')
  const midColor = new THREE.Color('#a5502d')
  const highColor = new THREE.Color('#dd9663')
  const dustColor = new THREE.Color('#d9a274')
  const sampleColor = new THREE.Color()

  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i)
    const z = positions.getZ(i)
    const y = terrainHeight(x, z)
    positions.setY(i, y)

    const elevation = THREE.MathUtils.smoothstep(y - terrainCurvature(x, z), -2.4, 1.2)
    sampleColor.lerpColors(lowColor, midColor, elevation)
    sampleColor.lerp(
      highColor,
      THREE.MathUtils.smoothstep(y - terrainCurvature(x, z), 0.3, 1.8) * 0.7
    )

    const inside = THREE.MathUtils.clamp(
      1 - Math.hypot(x - CRATER.x, z - CRATER.z) / CRATER.radius,
      0,
      1
    )
    sampleColor.multiplyScalar(1 - inside * 0.3)

    const flatten = THREE.MathUtils.smoothstep(Math.hypot(x - ROVER.x, z - ROVER.z), 3.2, 12)
    sampleColor.lerp(
      dustColor,
      THREE.MathUtils.smoothstep(duneCrest(x, z), 0.2, 1) * 0.18 * flatten
    )

    const streak = 0.5 + 0.5 * Math.sin(x * 0.8 + z * 0.55)
    sampleColor.lerp(dustColor, streak * 0.12)

    colors[i * 3] = sampleColor.r
    colors[i * 3 + 1] = sampleColor.g
    colors[i * 3 + 2] = sampleColor.b
  }
  terrainGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  terrainGeometry.computeVertexNormals()

  const regolithTexture = createRegolithTexture()
  regolithTexture?.repeat.set(44, 44)

  const terrain = new THREE.Mesh(
    terrainGeometry,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: regolithTexture ?? undefined,
      roughness: 1,
      metalness: 0.02
    })
  )
  sceneRef.add(terrain)
  extras.push(terrain)

  // --- Distant mesas behind the crater -----------------------------------
  const mesaMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 1,
    metalness: 0.02
  })
  const mesas: Array<[number, number, number, number]> = [
    [-46, -72, 20, 11],
    [48, -66, 15, 8],
    [-88, -24, 13, 7],
    [12, -108, 24, 12],
    [96, -88, 16, 9],
    [-110, -96, 18, 10]
  ]
  mesas.forEach(([x, z, height, radius], index) => {
    const mesa = createMassif(height, radius, 3.1 + index * 1.9, mesaMaterial)
    mesa.position.set(x, terrainHeight(x, z) - 1, z)
    mesa.rotation.y = Math.atan2(x, z)
    sceneRef.add(mesa)
    extras.push(mesa)
  })

  // --- Mars cargo lander on the far plain --------------------------------
  const landerGroup = new THREE.Group()
  landerGroup.position.set(LANDER.x, terrainHeight(LANDER.x, LANDER.z), LANDER.z)
  landerGroup.rotation.y = Math.atan2(ROVER.x - LANDER.x, ROVER.z - LANDER.z)
  sceneRef.add(landerGroup)
  extras.push(landerGroup)

  GLTFLoader('/models/viking-lander.glb', false)
    .then((model) => {
      if (disposed) {
        disposeModel(model)
        return
      }
      const bounds = new THREE.Box3().setFromObject(model)
      const size = new THREE.Vector3()
      bounds.getSize(size)
      model.scale.setScalar(LANDER_HEIGHT / Math.max(size.y, 0.001))
      bounds.setFromObject(model)
      model.position.set(0, -bounds.min.y, 0)
      landerGroup.add(model)
      loadedModels.push(model)
    })
    .catch(() => {})

  const landerScar = createBurnScar(LANDER.x, LANDER.z, 4.6, 11)
  sceneRef.add(landerScar)
  extras.push(landerScar)

  // --- Scattered rocks ----------------------------------------------------
  GLTFLoader('/models/mars-rocks.glb', false)
    .then((model) => {
      if (disposed) {
        disposeModel(model)
        return
      }

      const rockGeometries: THREE.BufferGeometry[] = []
      model.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return
        const geometry = child.geometry.clone()
        if (geometry.getAttribute('normal') === undefined) {
          geometry.computeVertexNormals()
        }
        geometry.computeBoundingBox()
        const bounds = geometry.boundingBox
        if (bounds) {
          const size = new THREE.Vector3()
          const center = new THREE.Vector3()
          bounds.getSize(size)
          bounds.getCenter(center)
          const longest = Math.max(size.x, size.y, size.z, 0.001)
          geometry.translate(-center.x, -center.y, -center.z)
          geometry.scale(2 / longest, 2 / longest, 2 / longest)
        }
        rockGeometries.push(geometry)
      })
      disposeModel(model)
      if (rockGeometries.length === 0) return

      const random = createRandom(20240607)
      const rockMaterials = [0x6d3320, 0x83402a, 0x55271b].map(
        (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.95, flatShading: true })
      )
      const pathSamples: THREE.Vector3[] = []
      for (let i = 0; i <= 200; i += 1) {
        pathSamples.push(driveCurve.getPointAt(i / 200))
      }
      const distanceToPath = (x: number, z: number) => {
        let nearest = Infinity
        for (const sample of pathSamples) {
          const distance = Math.hypot(x - sample.x, z - sample.z)
          if (distance < nearest) nearest = distance
        }
        return nearest
      }

      const placements: Array<{
        shape: number
        material: number
        x: number
        z: number
        scale: THREE.Vector3
        rotation: THREE.Euler
      }> = []

      const addStone = (x: number, z: number, size: number, clearance: number) => {
        if (Math.hypot(x - STATION.x, z - STATION.z) < 4.6) return
        if (Math.hypot(x - PLANT.x, z - PLANT.z) < 2.2) return
        if (Math.hypot(x - ROVER.x, z - ROVER.z) < 2.4) return
        if (Math.hypot(x - LANDER.x, z - LANDER.z) < 13) return
        if (distanceToPath(x, z) < clearance) return

        placements.push({
          shape: Math.floor(random() * rockGeometries.length),
          material: Math.floor(random() * rockMaterials.length),
          x,
          z,
          scale: new THREE.Vector3(
            size * (0.8 + random() * 0.5),
            size * (0.55 + random() * 0.45),
            size
          ),
          rotation: new THREE.Euler(
            (random() - 0.5) * 0.5,
            random() * Math.PI * 2,
            (random() - 0.5) * 0.5
          )
        })
      }

      for (let i = 0; i < 80; i += 1) {
        const angle = random() * Math.PI * 2
        const radius = 7 + random() * 95
        addStone(Math.cos(angle) * radius, Math.sin(angle) * radius, 0.45 + random() * 1.25, 2.2)
      }
      for (let i = 0; i < 260; i += 1) {
        const angle = random() * Math.PI * 2
        const radius = 2.5 + Math.pow(random(), 0.7) * 34
        addStone(Math.cos(angle) * radius, Math.sin(angle) * radius, 0.05 + random() * 0.22, 0.9)
      }
      for (let i = 0; i < 18; i += 1) {
        const angle = random() * Math.PI * 2
        const radius = 6 + random() * 52
        const centreX = Math.cos(angle) * radius
        const centreZ = Math.sin(angle) * radius
        const count = 4 + Math.floor(random() * 5)
        for (let k = 0; k < count; k += 1) {
          const spread = 0.5 + random() * 2.4
          const offset = random() * Math.PI * 2
          addStone(
            centreX + Math.cos(offset) * spread,
            centreZ + Math.sin(offset) * spread,
            0.14 + random() * 0.32,
            1.1
          )
        }
      }

      const matrix = new THREE.Matrix4()
      const position = new THREE.Vector3()
      const quaternion = new THREE.Quaternion()
      rockGeometries.forEach((geometry, shape) => {
        rockMaterials.forEach((material, materialIndex) => {
          const batch = placements.filter(
            (stone) => stone.shape === shape && stone.material === materialIndex
          )
          if (batch.length === 0) return

          const stones = new THREE.InstancedMesh(geometry, material, batch.length)
          batch.forEach((stone, index) => {
            position.set(stone.x, terrainHeight(stone.x, stone.z) + stone.scale.y * 0.55, stone.z)
            quaternion.setFromEuler(stone.rotation)
            matrix.compose(position, quaternion, stone.scale)
            stones.setMatrixAt(index, matrix)
          })
          stones.instanceMatrix.needsUpdate = true
          stones.computeBoundingSphere()
          sceneRef.add(stones)
          extras.push(stones)
        })
      })
    })
    .catch(() => {})

  // --- Downlink beacon ----------------------------------------------------
  const stationY = terrainHeight(STATION.x, STATION.z)
  linkLight = new PointLight(0x74e8ff, 0, 18, 2)
  linkLight.position.set(STATION.x, stationY + 2.6, STATION.z)
  sceneRef.add(linkLight)
  extras.push(linkLight)

  // --- Fern patch (Poly Haven, CC0) --------------------------------------
  const plantY = terrainHeight(PLANT.x, PLANT.z)
  plant = new THREE.Group()
  plant.position.set(PLANT.x, plantY, PLANT.z)
  plant.rotation.y = 0.7
  plant.scale.setScalar(0.45)
  sceneRef.add(plant)
  extras.push(plant)

  GLTFLoader('/models/fern_02/fern_02_1k.glb', false)
    .then((model) => {
      if (disposed) {
        disposeModel(model)
        return
      }
      const bounds = new THREE.Box3().setFromObject(model)
      const size = new THREE.Vector3()
      bounds.getSize(size)
      model.scale.setScalar(PLANT_WIDTH / Math.max(size.x, size.z, 0.001))
      plant?.add(model)
      loadedModels.push(model)
    })
    .catch(() => {})

  loupe = new Popup([PLANT.x, plantY + 0.62, PLANT.z], SpecimenLoupe, {})
  if (loupe.scene) {
    loupe.scene.center.set(0.5, 1)
    loupe.scene.element.style.opacity = '0'
    loupe.scene.element.style.pointerEvents = 'none'
    sceneRef.add(loupe.scene)
  }

  // --- Rover (NASA/JPL-Caltech) ------------------------------------------
  const roverGroup = new THREE.Group()
  roverGroup.rotation.order = 'YXZ'
  roverGroup.position.set(driveStart.x, 0, driveStart.z)
  sceneRef.add(roverGroup)
  drive = {
    roverGroup,
    waypoints: [],
    stops: [],
    index: 0,
    ready: false,
    endTime: Infinity,
    arrived: false,
    held: false,
    arriveTime: 0,
    arrivalHeading: 0,
    head: null,
    headBaseY: 0,
    sweep: null,
    wheels: [],
    wheelWorldRadius: WHEEL_RADIUS,
    wheelHalfWidths: [],
    tween: null,
    paused: false,
    pausedElapsed: 0
  }

  // --- Wheel ruts ---------------------------------------------------------
  const rutTexture = createRutTexture()
  const trackMaterial = new THREE.MeshBasicMaterial({
    color: 0x7a5535,
    map: rutTexture,
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4
  })
  const trackStrips: TrackStrip[] = []
  const trackMeshes: THREE.Mesh[] = []
  const trackIndices = new Uint16Array((TRACK_MAX_SAMPLES - 1) * 6)
  for (let i = 0; i < TRACK_MAX_SAMPLES - 1; i += 1) {
    const base = i * 2
    const index = i * 6
    trackIndices[index] = base
    trackIndices[index + 1] = base + 1
    trackIndices[index + 2] = base + 2
    trackIndices[index + 3] = base + 1
    trackIndices[index + 4] = base + 3
    trackIndices[index + 5] = base + 2
  }
  for (let wheel = 0; wheel < WHEEL_CENTERS.length; wheel += 1) {
    const stripPositions = new Float32Array(TRACK_MAX_SAMPLES * 2 * 3)
    const uvs = new Float32Array(TRACK_MAX_SAMPLES * 2 * 2)
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(stripPositions, 3).setUsage(THREE.DynamicDrawUsage)
    )
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2).setUsage(THREE.DynamicDrawUsage))
    geometry.setIndex(new THREE.BufferAttribute(trackIndices.slice(), 1))
    geometry.setDrawRange(0, 0)
    const mesh = new THREE.Mesh(geometry, trackMaterial)
    mesh.frustumCulled = false
    sceneRef.add(mesh)
    trackStrips.push({
      geometry,
      positions: stripPositions,
      uvs,
      count: 0,
      lastX: NaN,
      lastZ: NaN,
      distance: 0
    })
    trackMeshes.push(mesh)
  }
  track = { strips: trackStrips, meshes: trackMeshes, material: trackMaterial }

  GLTFLoader('/models/perseverance-draco.glb', { draco: true })
    .then((model) => {
      if (disposed) {
        disposeModel(model)
        return
      }

      const bounds = new THREE.Box3().setFromObject(model)
      const size = new THREE.Vector3()
      bounds.getSize(size)
      const maxDimension = Math.max(size.x, size.y, size.z, 0.001)
      model.scale.setScalar(2.8 / maxDimension)

      bounds.setFromObject(model)
      model.position.set(0, -bounds.min.y, 0)

      const currentDrive = drive
      if (!currentDrive) {
        disposeModel(model)
        return
      }

      currentDrive.roverGroup.add(model)
      currentDrive.head = model.getObjectByName('head') ?? null
      currentDrive.headBaseY = currentDrive.head ? currentDrive.head.rotation.y : 0

      const wheelsGroup = model.getObjectByName('Wheels_objs')
      if (wheelsGroup) {
        currentDrive.wheels = splitWheels(wheelsGroup, wheelCenters)
        currentDrive.wheelWorldRadius = WHEEL_RADIUS * model.scale.x
        const wheelSize = new THREE.Vector3()
        currentDrive.wheelHalfWidths = currentDrive.wheels.map((wheel) => {
          const box = new THREE.Box3()
          wheel.traverse((child) => {
            const mesh = child as THREE.Mesh
            if (!mesh.isMesh || !mesh.geometry) return
            if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox()
            if (mesh.geometry.boundingBox) box.union(mesh.geometry.boundingBox)
          })
          if (box.isEmpty()) return currentDrive.wheelWorldRadius * 0.55
          box.getSize(wheelSize)
          return (wheelSize.x * model.scale.x) / 2
        })
        wheelsGroup.clear()
        currentDrive.wheels.forEach((wheel) => wheelsGroup.add(wheel))
      }

      const first = driveCurve.getPointAt(1 / DRIVE_WAYPOINTS)
      currentDrive.roverGroup.rotation.y = Math.atan2(
        first.x - driveStart.x,
        first.z - driveStart.z
      )

      let at = performance.now() + 1500
      const previous = driveStart.clone()
      let stopIndex = 0
      for (let i = 1; i <= DRIVE_WAYPOINTS; i += 1) {
        const point = driveCurve.getPointAt(i / DRIVE_WAYPOINTS)
        const segmentLength = Math.hypot(point.x - previous.x, point.z - previous.z)
        const duration = (segmentLength / DRIVE_SPEED) * 1000
        currentDrive.waypoints.push({ x: point.x, z: point.z, at, duration })
        at += duration
        previous.set(point.x, 0, point.z)

        if (stopIndex < DRIVE_STOPS.length && i / DRIVE_WAYPOINTS >= DRIVE_STOPS[stopIndex].t) {
          currentDrive.stops.push({ at, duration: DRIVE_STOPS[stopIndex].dwell })
          at += DRIVE_STOPS[stopIndex].dwell
          stopIndex += 1
        }
      }
      currentDrive.endTime = at
      currentDrive.ready = true

      roverModel = model
      loadedModels.push(model)
    })
    .catch(() => {
      const currentDrive = drive
      if (currentDrive && !disposed) {
        currentDrive.ready = true
        currentDrive.endTime = performance.now() + 800
      }
    })

  // --- Signal wave launched from the vehicle toward Earth -----------------
  const roverY = terrainHeight(ROVER.x, ROVER.z)
  const signalOrigin = new THREE.Vector3(ROVER.x, roverY + 1.7, ROVER.z)
  signalWaves = new SignalWave({
    bearing: [earthDirection.x, earthDirection.y, earthDirection.z],
    origin: [signalOrigin.x, signalOrigin.y, signalOrigin.z],
    travel: SIGNAL_TRAVEL,
    period: SIGNAL_TRAVEL / SIGNAL_SPEED,
    count: SIGNAL_RING_COUNT,
    startScale: SIGNAL_PULSE_START,
    endScale: SIGNAL_PULSE_END
  })
  signalWaves.visible = false
  sceneRef.add(signalWaves)

  // --- The pale blue dot of Earth ----------------------------------------
  const earthDot = new GlowSprite({ size: 3.2 })
  earthDot.position.copy(earthDirection).multiplyScalar(EARTH_DISTANCE)
  sceneRef.add(earthDot)
  extras.push(earthDot)

  emitCaption(props.captions.intro)
}

onMounted(() => {
  const sceneRef = sceneSlotProps.scene
  const parts = sceneSlotProps.sceneComponents as unknown as SceneParts | undefined
  if (!sceneRef || !parts) return
  setupScene(sceneRef, parts)
})

onBeforeUnmount(() => {
  disposed = true

  if (drive) {
    drive.sweep?.dispose()
    drive.sweep = null
    drive.roverGroup.removeFromParent()
    drive = null
  }

  if (track) {
    for (const mesh of track.meshes) {
      mesh.removeFromParent()
      mesh.geometry.dispose()
    }
    if (track.material instanceof THREE.MeshBasicMaterial) track.material.map?.dispose()
    track.material.dispose()
    track = null
  }

  if (signalWaves) {
    signalWaves.dispose()
    signalWaves = null
  }
  if (scan) {
    scan.dispose()
    scan = null
  }

  if (loupe) {
    loupe.scene?.parent?.remove(loupe.scene)
    loupe.dispose()
    loupe = null
    lastLoupeOpacity = 0
  }

  if (roverModel) {
    disposeModel(roverModel)
    roverModel.removeFromParent()
    roverModel = null
  }

  if (skyDome) {
    skyDome.dispose()
    skyDome = null
  }

  linkLight = null
  plant = null
  scene = null
  previousTime = null

  for (const object of loadedModels) disposeModel(object)
  loadedModels.length = 0

  for (const object of extras) {
    object.removeFromParent()
    disposeObject(object)
  }
  extras.length = 0
})
</script>
