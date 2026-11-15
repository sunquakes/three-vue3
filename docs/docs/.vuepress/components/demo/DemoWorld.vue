<template>
  <tv-gltf-loader v-model="modelUrl" cache @loaded="onModelLoaded" />

  <tv-rain
    v-if="weather === 'rain'"
    :count="2600"
    :speed="26"
    :range="30"
    :height="26"
    :opacity="0.55"
    :wind="[3, 0]"
  />
  <tv-snow
    v-else-if="weather === 'snow'"
    :count="1800"
    :speed="2.4"
    :range="30"
    :height="26"
    :size="9"
    :wind="[0.6, 0]"
  />
</template>

<script lang="ts" setup>
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { onBeforeUnmount, onMounted, watch } from 'vue'
import {
  FitCamera,
  ModelRotator,
  Picker,
  SkyDome,
  disposeModel,
  globalParameterBus,
  useScene
} from 'three-vue3'

const props = defineProps({
  weather: {
    type: String,
    default: 'clear'
  },
  autoRotate: {
    type: Boolean,
    default: true
  },
  sunElevation: {
    type: Number,
    default: 18
  },
  sunAzimuth: {
    type: Number,
    default: 315
  }
})

const emit = defineEmits(['select'])

const modelUrl = '/models/perseverance.glb'

const sceneSlotProps = useScene()

let skyDome: SkyDome | undefined
let ground: THREE.Mesh | undefined
let grid: THREE.GridHelper | undefined
let sunLight: THREE.DirectionalLight | undefined
let model: THREE.Group | undefined
let rotator: ModelRotator | undefined
let picker: Picker | undefined
let highlighted: THREE.Mesh | null = null

const originalEmissive = new WeakMap<THREE.Material, number>()

function sunVector(elevation: number, azimuth: number) {
  const el = THREE.MathUtils.degToRad(elevation)
  const az = THREE.MathUtils.degToRad(azimuth)
  return new THREE.Vector3(
    Math.cos(el) * Math.sin(az),
    Math.sin(el),
    -Math.cos(el) * Math.cos(az)
  ).normalize()
}

function applySun() {
  const direction = sunVector(props.sunElevation, props.sunAzimuth)
  // The sky dome follows the shared parameter bus, so one set call also turns
  // the sun in the sky.
  globalParameterBus.set('sunDirection', direction)
  sunLight?.position.copy(direction).multiplyScalar(60)
}

function materialsOf(mesh: THREE.Mesh) {
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material]
}

function highlight(mesh: THREE.Mesh | null) {
  if (highlighted) {
    materialsOf(highlighted).forEach((material) => {
      const standard = material as THREE.MeshStandardMaterial
      if (standard.emissive) {
        standard.emissive.setHex(originalEmissive.get(material) ?? 0x000000)
      }
    })
  }

  highlighted = mesh

  if (mesh) {
    materialsOf(mesh).forEach((material) => {
      const standard = material as THREE.MeshStandardMaterial
      if (standard.emissive) {
        if (!originalEmissive.has(material)) {
          originalEmissive.set(material, standard.emissive.getHex())
        }
        standard.emissive.setHex(0xaa3311)
      }
    })
  }
}

function fitCamera() {
  const camera = sceneSlotProps.camera
  const controls = sceneSlotProps.sceneComponents?.controls
  if (!(camera instanceof FitCamera) || !model) return

  if (controls instanceof OrbitControls) {
    camera.bind(controls)
  }

  camera.fitToObject(model, {
    padding: 1.5,
    elevation: THREE.MathUtils.degToRad(20),
    azimuth: THREE.MathUtils.degToRad(35)
  })
}

function onModelLoaded(gltf: THREE.Group) {
  model = gltf

  // Drop the rover onto the ground plane.
  const box = new THREE.Box3().setFromObject(gltf)
  gltf.position.y -= box.min.y

  rotator = new ModelRotator(gltf, { speed: 0.25, autoStart: props.autoRotate })
  createPicker()
  fitCamera()
}

function createPicker() {
  const { scene, camera, renderer } = sceneSlotProps
  if (!scene || !camera || !renderer || !model) return

  picker?.dispose()
  picker = new Picker(scene, camera, renderer.domElement, {
    targets: [model],
    recursive: true
  })

  picker.on('hover', (event) => {
    renderer.domElement.style.cursor = event ? 'pointer' : ''
    highlight((event?.object as THREE.Mesh) ?? null)
  })

  picker.on('click', (event) => {
    emit('select', event?.object.name || 'Rover part')
  })

  // Expose the picker to the rest of the scene tree.
  sceneSlotProps.picker = picker
}

onMounted(() => {
  const scene = sceneSlotProps.scene
  if (!scene) return

  skyDome = new SkyDome({ radius: 400 })
  scene.add(skyDome)

  sunLight = new THREE.DirectionalLight(0xffd9b0, 2.4)
  scene.add(sunLight)
  applySun()

  ground = new THREE.Mesh(
    new THREE.CircleGeometry(200, 64),
    new THREE.MeshStandardMaterial({ color: 0x2a120c, roughness: 1, metalness: 0 })
  )
  ground.rotation.x = -Math.PI / 2
  scene.add(ground)

  grid = new THREE.GridHelper(120, 60, 0x9a5233, 0x53291b)
  grid.position.y = 0.002
  scene.add(grid)
})

watch(
  () => [props.sunElevation, props.sunAzimuth],
  () => applySun()
)

watch(
  () => props.autoRotate,
  (value) => {
    if (value) rotator?.play()
    else rotator?.pause()
  }
)

watch(
  () => props.weather,
  () => highlight(null)
)

onBeforeUnmount(() => {
  picker?.dispose()
  picker = undefined
  sceneSlotProps.picker = undefined

  rotator?.dispose()
  rotator = undefined

  if (model) {
    disposeModel(model)
    model = undefined
  }

  skyDome?.dispose()
  skyDome = undefined

  ground?.geometry.dispose()
  ;(ground?.material as THREE.Material | undefined)?.dispose()
  ground?.parent?.remove(ground)
  ground = undefined

  grid?.geometry.dispose()
  ;(grid?.material as THREE.Material | undefined)?.dispose()
  grid?.parent?.remove(grid)
  grid = undefined

  sunLight?.parent?.remove(sunLight)
  sunLight = undefined
})

defineExpose({ fitCamera })
</script>
