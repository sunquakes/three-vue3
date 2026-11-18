// Import from 'three/webgpu' so light classes match the classes registered in
// the WebGPURenderer node library. 'three' and 'three/webgpu' are two separate
// builds with distinct class identities; lights created from 'three' are never
// found by LightsNode.setupNodeLights ("Light node not found") and silently
// have no effect on rendering.
import * as THREE from 'three/webgpu'

export default function (): THREE.Group {
  const group = new THREE.Group()

  // AmbientLight provides base illumination for PBR materials. Keep it low
  // since the scene already provides an IBL environment; a high value here
  // doubles up on the environment light and blows out PBR surfaces.
  const ambient = new THREE.AmbientLight(0xffffff, 1)
  group.add(ambient)

  // DirectionalLight provides specular highlights and normal-map detail.
  // Required for PBR materials to show surface detail.
  const directional = new THREE.DirectionalLight(0xffffff, 3)
  directional.position.set(5, 10, 7)
  group.add(directional)

  return group
}
