import * as THREE from 'three'

export default function (): THREE.Light {
  const light = new THREE.AmbientLight(0xffffff, 1)
  light.intensity = 10
  return light
}
