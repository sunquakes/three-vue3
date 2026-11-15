<template>
  <tv-scene
    class="popup"
    bg-color="#ffffff"
    @created="created"
  ></tv-scene>
</template>

<script lang="ts" setup>
import { onBeforeUnmount } from 'vue'
import { Popup } from 'three-vue3'
import TrafficLight from './TrafficLight.vue'

let popup: Popup | undefined

const created = (scene, { camera }) => {
  camera.position.set(0, 1.5, 3)

  // Popup starts at [0, 0.5, 0] with the traffic-light component inside.
  popup = new Popup([0, 0.5, 0], TrafficLight, {})
  scene.add(popup.scene)

  // Move it up to [0, 1.2, 0] over 2 seconds.
  popup.moveTo([0, 1.2, 0], 2000)
}

// The popup owns a Vue app, a DOM container and a move loop; release them when
// the scene is torn down (navigation or a renderer switch).
onBeforeUnmount(() => {
  popup?.dispose()
  popup = undefined
})
</script>

<style>
.popup {
  margin-top: 10px;
  margin-bottom: 16px;
  width: 100%;
  height: 300px;
}
</style>
