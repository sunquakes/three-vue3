<template>
  <tv-scene
    class="scene"
    bg-color="rgb(40, 42, 54)"
    :axes-helper="false"
    :grid-helper="false"
    @created="created"
  >
    <tv-water-pool :shape="TUB_OUTLINE" :scale="WATER_SCALE" :position="[0, WATER_Y, 0]" />
    <PoolEnvironment />
  </tv-scene>
</template>

<script lang="ts" setup>
import { defineComponent, onBeforeUnmount } from 'vue'
import * as THREE from 'three'
import { GLTFLoader, SkyDome, disposeModel, globalParameterBus, useScene } from 'three-vue3'
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

// The tub is 1.19 x 0.56 units with its rim at y = 0.35 and its floor at y = 0.
const TUB_SCALE = 1.7
// The outline is normalised by half of the rim opening (0.536 units), so the
// pool scale is that half extent in world units and the water depth matches it.
const WATER_SCALE = 0.536 * TUB_SCALE
const WATER_Y = 0.33 * TUB_SCALE

// Top view of the bathtub opening: a long rounded rectangle that follows the
// inner rim. The water uses the same outline, so it reaches the walls all round.
const TUB_OUTLINE: [number, number][] = [
  [-1, 0],
  [-0.987, -0.106],
  [-0.945, -0.207],
  [-0.879, -0.291],
  [-0.795, -0.358],
  [-0.694, -0.399],
  [-0.588, -0.412],
  [0.513, -0.412],
  [0.619, -0.399],
  [0.72, -0.358],
  [0.804, -0.291],
  [0.871, -0.207],
  [0.981, -0.028],
  [0.981, 0.028],
  [0.871, 0.207],
  [0.804, 0.291],
  [0.72, 0.358],
  [0.619, 0.399],
  [0.513, 0.412],
  [-0.588, 0.412],
  [-0.694, 0.399],
  [-0.795, 0.358],
  [-0.879, 0.291],
  [-0.945, 0.207],
  [-0.987, 0.106]
]

const PoolEnvironment = defineComponent({
  setup() {
    const { scene } = useScene()
    let dome: SkyDome | undefined
    let tub: THREE.Group | undefined
    let disposed = false

    if (scene) {
      dome = new SkyDome({
        horizonColor: 0x94c2f0,
        lowerSkyColor: 0x7fb4ec,
        upperSkyColor: 0x3d7bd5,
        zenithColor: 0x296bc7,
        glowColor: 0xfff1d8,
        sunColor: 0xfff7e6,
        sunIntensity: 2.2,
        sunSize: 5
      })
      scene.add(dome)

      const loadTub = async () => {
        const model = await GLTFLoader('/models/bathtub.glb', {
          draco: false
        })
        if (disposed) {
          disposeModel(model)
          return
        }
        model.scale.setScalar(TUB_SCALE)
        model.position.set(-0.595 * TUB_SCALE, 0, 0.28 * TUB_SCALE)
        scene.add(model)
        tub = model
      }
      void loadTub()
    }

    onBeforeUnmount(() => {
      disposed = true
      dome?.dispose()
      dome = undefined
      if (tub) disposeModel(tub)
      tub = undefined
    })

    return () => null
  }
})

const created = (
  _scene: THREE.Scene,
  { camera, controls }: { camera?: THREE.Camera; controls?: OrbitControls }
) => {
  globalParameterBus.set('sunDirection', new THREE.Vector3(0.55, 0.9, 0.35))
  if (!camera) return
  camera.position.set(1.7, 1.35, 1.9)
  if (controls) controls.target.set(0, 0.3, 0)
  camera.lookAt(0, 0.3, 0)
}
</script>

<style>
.scene {
  margin-top: 10px;
  margin-bottom: 16px;
  width: 100%;
  height: 300px;
}
</style>
