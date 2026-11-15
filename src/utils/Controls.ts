import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

export default function (camera: THREE.Camera, renderer: R3LRenderer): OrbitControls {
  const controls = new OrbitControls(camera, renderer.domElement as HTMLElement)
  controls.target = new THREE.Vector3(0, 0, 0)
  return controls
}
