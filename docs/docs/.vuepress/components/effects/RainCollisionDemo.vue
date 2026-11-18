<template>
  <tv-scene
    class="scene"
    bg-color="rgb(28, 30, 40)"
    :axes-helper="false"
    :grid-helper="false"
    @created="created"
  >
    <tv-rain
      v-if="heightMap"
      :count="5000"
      :speed="1"
      :range="TERRAIN_SIZE"
      :height="RAIN_HEIGHT"
      :wind-x="0.12"
      :wind-z="0.05"
      :color="0x9fc6e8"
      :opacity="0.85"
      :height-map="heightMap"
      :height-map-size="TERRAIN_SIZE"
      :height-map-amplitude="HEIGHT_MAP_AMPLITUDE"
      :ground-height="GROUND_Y"
      :splash-size="1"
      :splash-duration="0.7"
    />
  </tv-scene>
</template>

<script lang="ts" setup>
import { onBeforeUnmount, shallowRef } from 'vue'
import * as THREE from 'three'
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

const TERRAIN_SIZE = 40
const MAP_RESOLUTION = 256
const RAIN_HEIGHT = 24
const HEIGHT_MAP_AMPLITUDE = RAIN_HEIGHT * 0.4
const GROUND_Y = -RAIN_HEIGHT / 2

function hash(x: number, y: number, seed: number) {
  const value = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453
  return value - Math.floor(value)
}

function valueNoise(x: number, y: number, seed: number) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const xf = x - xi
  const yf = y - yi
  const u = xf * xf * (3 - 2 * xf)
  const v = yf * yf * (3 - 2 * yf)

  const a = hash(xi, yi, seed)
  const b = hash(xi + 1, yi, seed)
  const c = hash(xi, yi + 1, seed)
  const d = hash(xi + 1, yi + 1, seed)

  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v
}

// Row 0 is the top of the image. Rain and the terrain sample the same field,
// so every drop lands on the rendered surface.
function createHeightField(size: number) {
  const field = new Float32Array(size * size)

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const u = col / size
      const v = row / size
      let height = 0
      let amplitude = 0.55
      let frequency = 3

      for (let octave = 0; octave < 3; octave++) {
        height += valueNoise(u * frequency, v * frequency, octave * 17) * amplitude
        amplitude *= 0.5
        frequency *= 2
      }

      height += Math.sin(u * Math.PI * 2) * Math.cos(v * Math.PI * 2) * 0.12
      field[row * size + col] = THREE.MathUtils.clamp(height, 0, 1)
    }
  }

  return field
}

function createHeightMapTexture(field: Float32Array, size: number) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const image = ctx.createImageData(size, size)

  for (let i = 0; i < field.length; i++) {
    const value = Math.round(field[i] * 255)
    image.data[i * 4] = value
    image.data[i * 4 + 1] = value
    image.data[i * 4 + 2] = value
    image.data[i * 4 + 3] = 255
  }

  ctx.putImageData(image, 0, 0)

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.generateMipmaps = false
  texture.minFilter = THREE.LinearFilter
  texture.needsUpdate = true
  return texture
}

const heightMap = shallowRef<THREE.CanvasTexture | null>(null)
let terrain: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial> | null = null
let disposed = false

const created = (
  scene: THREE.Scene,
  { camera, controls }: { camera: THREE.Camera; controls: OrbitControls }
) => {
  if (disposed) return

  camera.position.set(0, 8, 27)
  controls.target.set(0, -3, 0)
  controls.update()

  const field = createHeightField(MAP_RESOLUTION)
  const texture = createHeightMapTexture(field, MAP_RESOLUTION)
  heightMap.value = texture

  const geometry = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, 160, 160)
  geometry.rotateX(-Math.PI / 2)
  const positions = geometry.attributes.position
  const uvAttribute = geometry.attributes.uv
  const colors = new Float32Array(positions.count * 3)
  const lowColor = new THREE.Color('#1b2230')
  const highColor = new THREE.Color('#55647d')
  const color = new THREE.Color()

  for (let i = 0; i < positions.count; i++) {
    const u = uvAttribute.getX(i)
    const v = uvAttribute.getY(i)
    const col = THREE.MathUtils.clamp(Math.round(u * (MAP_RESOLUTION - 1)), 0, MAP_RESOLUTION - 1)
    const row = THREE.MathUtils.clamp(
      Math.round((1 - v) * (MAP_RESOLUTION - 1)),
      0,
      MAP_RESOLUTION - 1
    )
    const sample = field[row * MAP_RESOLUTION + col]

    positions.setY(i, GROUND_Y + sample * HEIGHT_MAP_AMPLITUDE)
    color.copy(lowColor).lerp(highColor, sample)
    colors[i * 3] = color.r
    colors[i * 3 + 1] = color.g
    colors[i * 3 + 2] = color.b
  }

  positions.needsUpdate = true
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.computeVertexNormals()

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.85,
    metalness: 0.05
  })
  terrain = new THREE.Mesh(geometry, material)
  terrain.name = 'RainCollisionTerrain'
  scene.add(terrain)
}

onBeforeUnmount(() => {
  disposed = true
  if (terrain) {
    terrain.removeFromParent()
    terrain.geometry.dispose()
    terrain.material.dispose()
    terrain = null
  }
  heightMap.value?.dispose()
  heightMap.value = null
})
</script>

<style>
.scene {
  margin-top: 10px;
  margin-bottom: 16px;
  width: 100%;
  height: 300px;
}
</style>
