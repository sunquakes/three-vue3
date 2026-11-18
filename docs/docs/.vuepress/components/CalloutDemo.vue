<template>
  <tv-scene class="scene" bg-color="rgb(40, 42, 54)" @created="created"></tv-scene>
</template>

<script lang="ts" setup>
import { onBeforeUnmount } from 'vue'
import * as THREE from 'three'
import { Callout } from 'three-vue3'

let callout: Callout | undefined

const created = (scene, { camera }) => {
  camera.position.set(0, 0, 5)
  camera.lookAt(0, 0, 0)

  // A box at the origin that the annotation points to.
  const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshNormalMaterial())
  scene.add(box)

  const label = document.createElement('div')
  label.textContent = 'This is a box!'
  label.style.padding = '8px 14px'
  label.style.background = 'linear-gradient(180deg, #ff8a2b 0%, #e66400 100%)'
  label.style.borderRadius = '4px'
  label.style.color = '#1a0f00'
  label.style.fontSize = '16px'
  label.style.fontWeight = '600'
  label.style.boxShadow = '0 2px 8px rgba(255, 138, 43, 0.35)'
  label.style.pointerEvents = 'auto'
  label.style.whiteSpace = 'nowrap'
  label.style.userSelect = 'none'

  // Start (anchor) on the box corner, end (label) out to the right.
  callout = new Callout([0.5, 0.5, 0.5], [1.5, 1.0, 0.5], label, {
    color: '#ffffff',
    lineWidth: 2,
    lineShape: 'broken',
    dashed: false,
    showDot: true,
    dotColor: '#ffffff',
    dotRadius: 0.06
  })
  scene.add(callout.scene)
  callout.attach(camera)
}

onBeforeUnmount(() => {
  callout?.dispose()
  callout = undefined
})
</script>

<style>
.scene {
  margin-top: 10px;
  margin-bottom: 16px;
  width: 100%;
  height: 360px;
}
</style>
