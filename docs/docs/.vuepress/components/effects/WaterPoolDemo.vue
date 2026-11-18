<template>
  <tv-scene
    class="scene"
    bg-color="rgb(40, 42, 54)"
    :axes-helper="false"
    :grid-helper="false"
    @created="created"
  >
    <tv-water-pool :shape="WATER_OUTLINE" :scale="WATER_SCALE" />
    <PoolEnvironment />
  </tv-scene>
</template>

<script lang="ts" setup>
import { defineComponent, onBeforeUnmount } from 'vue'
import * as THREE from 'three'
import { GLTFLoader, SkyDome, disposeModel, globalParameterBus, useScene } from 'three-vue3'
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

// The pool depth scales with the water, so the surface stays 0.7 units deep.
const WATER_SCALE = 0.7

// The model is 0.86 x 0.74 x 1.64 units with its floor at y = 0, its rim at
// y = 0.53 and its inner opening 0.66 x 1.44 (no textures, about 3k triangles).
// These scales turn that opening into a 1.05 x 1.25 basin small enough to sit
// under the camera, and the height keeps the rim 9 cm above the surface.
const TUB_SCALE: [number, number, number] = [1.59, 1.15, 0.868]
const TUB_Y = 0.09 - 0.53 * TUB_SCALE[1]

// The water follows the tub opening with a 2 cm tuck under the porcelain, so
// the surface meets all four walls with no gap. The outline is in pool space,
// which WaterPool scales by WATER_SCALE.
const WATER_HALF_X = (0.33 * TUB_SCALE[0] + 0.02) / WATER_SCALE
const WATER_HALF_Z = (0.72 * TUB_SCALE[2] + 0.02) / WATER_SCALE
const WATER_OUTLINE: [number, number][] = [
  [-WATER_HALF_X, -WATER_HALF_Z],
  [WATER_HALF_X, -WATER_HALF_Z],
  [WATER_HALF_X, WATER_HALF_Z],
  [-WATER_HALF_X, WATER_HALF_Z]
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
        const model = await GLTFLoader('/models/water-tub.glb', {
          draco: false
        })
        if (disposed) {
          disposeModel(model)
          return
        }
        model.scale.set(...TUB_SCALE)
        model.position.set(0, TUB_Y, 0)
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
  camera.position.set(1.75, 2.2, 2.0)
  if (controls) controls.target.set(0, 0, 0)
  camera.lookAt(0, 0, 0)
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
