<template>
  <tv-scene class="scene" bg-color="rgb(40, 42, 54)" @created="created">
    <tv-snow
      :count="1200"
      :speed="0.5"
      :color="0xffffff"
      :range="16"
      :height="14"
      :wind-x="0.2"
      :wind-z="0.08"
      accumulate
      :accumulation-thickness="0.12"
      :accumulation-duration="6"
    />
  </tv-scene>
</template>

<script lang="ts" setup>
import { onBeforeUnmount } from 'vue'
import * as THREE from 'three'

const objects: THREE.Object3D[] = []

const created = (scene, { camera }) => {
  camera.position.set(0, 1.6, 6)
  camera.lookAt(0, -0.2, 0)

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 10),
    new THREE.MeshStandardMaterial({ color: '#39404f', roughness: 1 })
  )
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -1.4

  const rock = new THREE.Mesh(
    new THREE.SphereGeometry(0.9, 48, 32),
    new THREE.MeshStandardMaterial({ color: '#4c566a', roughness: 0.85 })
  )
  rock.position.set(-1.6, -0.5, -0.4)
  rock.scale.set(1, 0.8, 1)

  const block = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 1.5, 1.5),
    new THREE.MeshStandardMaterial({ color: '#434c5e', roughness: 0.9 })
  )
  block.position.set(1.5, -0.65, -0.6)
  block.rotation.y = Math.PI / 6

  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.45, 1.6, 32),
    new THREE.MeshStandardMaterial({ color: '#3f4657', roughness: 0.9 })
  )
  pillar.position.set(0.2, -0.6, -1.8)

  scene.add(ground, rock, block, pillar)
  objects.push(ground, rock, block, pillar)
}

onBeforeUnmount(() => {
  objects.forEach((object) => {
    const mesh = object as THREE.Mesh
    mesh.geometry.dispose()
    ;(mesh.material as THREE.Material).dispose()
    mesh.removeFromParent()
  })
  objects.length = 0
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
