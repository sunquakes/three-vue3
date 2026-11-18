import * as THREE from 'three'
import { BeachWalker, beachHeight } from './BeachTerrain'
import { BeachFootprintTrail } from './BeachFootprints'
import {
  applyBeachPresetToUniforms,
  createBeachMaterials,
  createBeachUniforms,
  BEACH_SKY_RADIUS
} from './BeachMaterials'
import type { BeachPresetName } from './BeachPresets'
import { createBeachPresetState, lerpBeachPresetState } from './BeachPresets'
import { createNoiseTexture } from './WaterNoise'

const CAMERA_FOV = 62
const CAMERA_NEAR = 0.05
const CAMERA_FAR = 7000

/** Live props read by the beach animation loop. */
export interface BeachSceneOptions {
  preset: () => BeachPresetName
  autoWalk: () => boolean
  crouching: () => boolean
  interactive: () => boolean
}

/**
 * Builds the beach scene inside the given scene slot and takes over the camera.
 * Returns a cleanup function that restores everything it changed, or `undefined`
 * when the slot has not been populated yet.
 */
export function mountBeachScene(
  context: SceneSlotProps,
  options: BeachSceneOptions
): (() => void) | undefined {
  const { renderer, scene, sceneComponents, addBeforeFrame } = context
  if (!renderer || !scene || !sceneComponents?.camera || !addBeforeFrame) {
    return undefined
  }

  // The library types the scene camera as `THREE.Camera`; the scene always
  // creates (or accepts) a perspective camera, so the first-person walker can
  // use the perspective-only fields after a narrow check.
  const camera = sceneComponents.camera
  if (!(camera instanceof THREE.PerspectiveCamera)) {
    return undefined
  }

  // Controls are optional in this library's slot and may be a boolean flag.
  const controls = sceneComponents.controls
  if (!controls || typeof controls === 'boolean') {
    return undefined
  }

  const domElement = renderer.domElement

  const noiseTexture = createNoiseTexture()
  const footprints = new BeachFootprintTrail()
  const uniforms = createBeachUniforms()
  const materials = createBeachMaterials({
    uniforms,
    noiseMap: noiseTexture,
    footprintTexture: footprints.texture
  })

  const skyGeometry = new THREE.SphereGeometry(BEACH_SKY_RADIUS, 64, 32)

  const group = new THREE.Group()
  group.name = 'SandyBeach'

  const skyMesh = new THREE.Mesh(skyGeometry, materials.sky)
  skyMesh.name = 'SandyBeachSky'
  skyMesh.renderOrder = -1
  skyMesh.frustumCulled = false
  group.add(skyMesh)

  scene.add(group)

  // Save everything the scene owns before taking it over.
  const previousFov = camera.fov
  const previousNear = camera.near
  const previousFar = camera.far
  const previousPosition = camera.position.clone()
  const previousQuaternion = camera.quaternion.clone()
  const previousRotationOrder = camera.rotation.order
  const previousControlsEnabled = controls.enabled
  const previousControlsUpdate = controls.update
  const previousGridVisible = sceneComponents.gridHelper?.visible
  const previousAxesVisible = sceneComponents.axesHelper?.visible

  camera.fov = CAMERA_FOV
  camera.near = CAMERA_NEAR
  camera.far = CAMERA_FAR
  camera.updateProjectionMatrix()
  camera.rotation.order = 'YXZ'

  // OrbitControls would overwrite the first-person pose every frame, both while
  // enabled and while its update runs, so it is disabled and silenced.
  controls.enabled = false
  controls.update = () => false
  if (sceneComponents.gridHelper) sceneComponents.gridHelper.visible = false
  if (sceneComponents.axesHelper) sceneComponents.axesHelper.visible = false

  const initialPreset = options.preset()
  const initialState = createBeachPresetState(initialPreset)
  applyBeachPresetToUniforms(uniforms, initialState)

  // Start on the stretch of shore that faces the sun at this time of day.
  const sunDirection = initialState.sunDirection
  const startTheta = Math.atan2(sunDirection.z, sunDirection.x)
  const outwardX = Math.cos(startTheta)
  const outwardZ = Math.sin(startTheta)
  const startYaw = Math.atan2(-outwardX, -outwardZ) + 0.22

  const walker = new BeachWalker({
    theta: startTheta,
    u: 6,
    yaw: startYaw,
    pitch: -0.13
  })

  const presetState = createBeachPresetState(initialPreset)
  let targetPreset = initialPreset
  let targetState = createBeachPresetState(targetPreset)

  let elapsed = 0
  let wheelImpulse = 0
  const keys = new Set<string>()
  const clock = new THREE.Timer()
  let hovered = false
  let pointerId: number | null = null
  let lastPointerX = 0
  let lastPointerY = 0

  const sensitivity = () => (1.1 / Math.max(320, domElement.clientHeight)) * 1.6

  const handlePointerDown = (event: PointerEvent) => {
    if (!options.interactive() || event.button !== 0) {
      return
    }
    pointerId = event.pointerId
    lastPointerX = event.clientX
    lastPointerY = event.clientY
    domElement.setPointerCapture?.(event.pointerId)
    event.preventDefault()
  }

  const handlePointerMove = (event: PointerEvent) => {
    if (pointerId !== event.pointerId) {
      return
    }
    walker.setLookDelta(event.clientX - lastPointerX, event.clientY - lastPointerY, sensitivity())
    lastPointerX = event.clientX
    lastPointerY = event.clientY
  }

  const handlePointerUp = (event: PointerEvent) => {
    if (pointerId !== event.pointerId) {
      return
    }
    domElement.releasePointerCapture?.(event.pointerId)
    pointerId = null
  }

  const handlePointerEnter = () => {
    hovered = true
  }

  const handlePointerLeave = () => {
    hovered = false
  }

  const handleWheel = (event: WheelEvent) => {
    if (!options.interactive()) {
      return
    }
    wheelImpulse = THREE.MathUtils.clamp(wheelImpulse - event.deltaY * 0.0016, -1, 1)
    event.preventDefault()
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    if (!options.interactive() || !hovered) {
      return
    }
    keys.add(event.key.toLowerCase())
  }

  const handleKeyUp = (event: KeyboardEvent) => {
    keys.delete(event.key.toLowerCase())
  }

  domElement.addEventListener('pointerdown', handlePointerDown)
  domElement.addEventListener('pointerenter', handlePointerEnter)
  domElement.addEventListener('pointerleave', handlePointerLeave)
  domElement.addEventListener('wheel', handleWheel, { passive: false })
  window.addEventListener('pointermove', handlePointerMove)
  window.addEventListener('pointerup', handlePointerUp)
  window.addEventListener('pointercancel', handlePointerUp)
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)

  const axis = (positive: string[], negative: string[]) => {
    const forward = positive.some((key) => keys.has(key)) ? 1 : 0
    const backward = negative.some((key) => keys.has(key)) ? 1 : 0
    return forward - backward
  }

  const applyPose = (frame: ReturnType<BeachWalker['update']>) => {
    camera.position.set(frame.x, beachHeight(frame.u) + frame.eyeHeight, frame.z)
    camera.rotation.set(frame.pitch, frame.yaw, 0, 'YXZ')
  }

  const initialFrame = walker.update(0, { crouching: options.crouching() })
  applyPose(initialFrame)

  const syncBackground = () => {
    // The shader fills rays that miss sand and water itself, so it has to
    // follow the Scene background colour instead of relying on canvas alpha.
    if (scene.background instanceof THREE.Color) {
      uniforms.background.value.set(
        scene.background.r,
        scene.background.g,
        scene.background.b
      )
    }
  }

  const removeFrame = addBeforeFrame(() => {
    clock.update()
    const delta = Math.min(clock.getDelta(), 0.1)
    elapsed += delta

    if (options.preset() !== targetPreset) {
      targetPreset = options.preset()
      targetState = createBeachPresetState(targetPreset)
    }
    lerpBeachPresetState(presetState, targetState, 1 - Math.exp(-delta * 2.4))
    applyBeachPresetToUniforms(uniforms, presetState)

    uniforms.time.value = elapsed
    syncBackground()

    const forwardInput = axis(['w', 'arrowup'], ['s', 'arrowdown'])
    const strafeInput = axis(['d', 'arrowright'], ['a', 'arrowleft'])
    const frame = walker.update(delta, {
      forward: THREE.MathUtils.clamp(forwardInput + wheelImpulse, -1, 1),
      strafe: strafeInput,
      autoWalk: options.autoWalk(),
      crouching: options.crouching()
    })
    applyPose(frame)

    wheelImpulse *= Math.exp(-5 * delta)
    if (Math.abs(wheelImpulse) < 0.001) {
      wheelImpulse = 0
    }

    frame.footprints.forEach((footprint) => footprints.add(footprint, elapsed))
  })

  return () => {
    removeFrame()
    domElement.removeEventListener('pointerdown', handlePointerDown)
    domElement.removeEventListener('pointerenter', handlePointerEnter)
    domElement.removeEventListener('pointerleave', handlePointerLeave)
    domElement.removeEventListener('wheel', handleWheel)
    window.removeEventListener('pointermove', handlePointerMove)
    window.removeEventListener('pointerup', handlePointerUp)
    window.removeEventListener('pointercancel', handlePointerUp)
    window.removeEventListener('keydown', handleKeyDown)
    window.removeEventListener('keyup', handleKeyUp)

    scene.remove(group)
    skyGeometry.dispose()
    materials.sky.dispose()
    noiseTexture.dispose()
    footprints.dispose()

    controls.update = previousControlsUpdate
    controls.enabled = previousControlsEnabled
    if (sceneComponents.gridHelper) {
      sceneComponents.gridHelper.visible = previousGridVisible ?? true
    }
    if (sceneComponents.axesHelper) {
      sceneComponents.axesHelper.visible = previousAxesVisible ?? true
    }

    camera.fov = previousFov
    camera.near = previousNear
    camera.far = previousFar
    camera.position.copy(previousPosition)
    camera.quaternion.copy(previousQuaternion)
    camera.rotation.order = previousRotationOrder
    camera.updateProjectionMatrix()
  }
}
