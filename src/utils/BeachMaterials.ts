import * as THREE from 'three'
import {
  Fn,
  If,
  Loop,
  atan,
  cameraPosition,
  clamp,
  cos,
  dot,
  exp,
  float,
  fract,
  length,
  max,
  min,
  mix,
  normalize,
  positionWorld,
  pow,
  reflect,
  sin,
  smoothstep,
  step,
  texture,
  uniform,
  vec2,
  vec3,
  vec4
} from 'three/tsl'
import { MeshBasicNodeMaterial } from 'three/webgpu'
import type { Node, UniformNode } from 'three/webgpu'
import { fbmNode, microGradientNode } from './WaterShading'
import {
  BEACH_CIRCUMFERENCE,
  BEACH_DOME_HEIGHT,
  BEACH_DOME_RADIUS,
  BEACH_FOOTPRINT_LIFETIME,
  BEACH_RADIUS
} from './BeachTerrain'
import { BEACH_FOOTPRINT_CAPACITY } from './BeachFootprints'
import type { BeachPresetState } from './BeachPresets'

/** Radius of the sky dome, in world units. The camera stays well inside. */
export const BEACH_SKY_RADIUS = 4200

export interface BeachUniforms {
  time: UniformNode<'float', number>
  exposure: UniformNode<'float', number>
  sunDirection: UniformNode<'vec3', THREE.Vector3>
  sunColor: UniformNode<'vec3', THREE.Vector3>
  zenith: UniformNode<'vec3', THREE.Vector3>
  horizon: UniformNode<'vec3', THREE.Vector3>
  horizonSun: UniformNode<'vec3', THREE.Vector3>
  mid: UniformNode<'vec3', THREE.Vector3>
  glow: UniformNode<'vec3', THREE.Vector3>
  cloudSun: UniformNode<'vec3', THREE.Vector3>
  cloudShade: UniformNode<'vec3', THREE.Vector3>
  sand: UniformNode<'vec3', THREE.Vector3>
  waterDeep: UniformNode<'vec3', THREE.Vector3>
  waterShallow: UniformNode<'vec3', THREE.Vector3>
  /** Scene background colour, used to fill rays that miss sand and water. */
  background: UniformNode<'vec3', THREE.Vector3>
  sunDisk: UniformNode<'float', number>
  discSize: UniformNode<'float', number>
  night: UniformNode<'float', number>
  sunLight: UniformNode<'float', number>
}

const vectorUniform = (hex: string): UniformNode<'vec3', THREE.Vector3> => {
  const color = new THREE.Color(hex)
  return uniform(new THREE.Vector3(color.r, color.g, color.b))
}

export function createBeachUniforms(): BeachUniforms {
  return {
    time: uniform(0),
    exposure: uniform(1.1),
    sunDirection: uniform(new THREE.Vector3(0, 0.2, 1).normalize()),
    sunColor: vectorUniform('#ffca8a'),
    zenith: vectorUniform('#1054a4'),
    horizon: vectorUniform('#b296ac'),
    horizonSun: vectorUniform('#fcb06e'),
    mid: vectorUniform('#eeca9f'),
    glow: vectorUniform('#ffc77a'),
    cloudSun: vectorUniform('#ffd7b0'),
    cloudShade: vectorUniform('#8f8fae'),
    sand: vectorUniform('#cdb698'),
    waterDeep: vectorUniform('#0b2f4a'),
    waterShallow: vectorUniform('#3d7f84'),
    background: vectorUniform('#282a36'),
    sunDisk: uniform(2.4),
    discSize: uniform(1.2),
    night: uniform(0),
    sunLight: uniform(1.35)
  }
}

const setVector = (target: UniformNode<'vec3', THREE.Vector3>, color: THREE.Color) => {
  target.value.set(color.r, color.g, color.b)
}

/** Copies a blended preset snapshot into the shader uniforms. */
export function applyBeachPresetToUniforms(
  uniforms: BeachUniforms,
  state: BeachPresetState
): void {
  uniforms.sunDirection.value.copy(state.sunDirection)
  setVector(uniforms.sunColor, state.sunColor)
  setVector(uniforms.zenith, state.zenith)
  setVector(uniforms.horizon, state.horizon)
  setVector(uniforms.horizonSun, state.horizonSun)
  setVector(uniforms.mid, state.mid)
  setVector(uniforms.glow, state.glow)
  setVector(uniforms.cloudSun, state.cloudSun)
  setVector(uniforms.cloudShade, state.cloudShade)
  setVector(uniforms.sand, state.sand)
  setVector(uniforms.waterDeep, state.waterDeep)
  setVector(uniforms.waterShallow, state.waterShallow)
  uniforms.sunDisk.value = state.sunDisk
  uniforms.discSize.value = state.discSize
  uniforms.night.value = state.night
  uniforms.sunLight.value = state.sunLight
  uniforms.exposure.value = state.exposure
}

/** ACES filmic curve, applied to linear HDR values before output. */
const acesNode = (value: Node<'float'>): Node<'float'> =>
  clamp(
    value.mul(value.mul(2.51).add(0.03)).div(value.mul(value.mul(2.43).add(0.59)).add(0.14)),
    0,
    1
  )

const beachToneMapNode = (color: Node<'vec3'>, exposure: Node<'float'>): Node<'vec3'> =>
  vec3(
    acesNode(color.x.mul(exposure)),
    acesNode(color.y.mul(exposure)),
    acesNode(color.z.mul(exposure))
  )

/** Sand profile shared with `beachHeight()` in BeachTerrain. */
const beachHeightNode = (u: Node<'float'>): Node<'float'> => {
  const shore = clamp(u, 0, 2.8).mul(0.22)
  const inland = max(u.sub(2.8), 0).mul(0.08)
  const radius = float(BEACH_RADIUS).sub(u)
  const domeRatio = min(radius.abs().div(BEACH_DOME_RADIUS), 1)
  const dome = pow(float(1).sub(domeRatio.mul(domeRatio)), 2).mul(BEACH_DOME_HEIGHT)
  const bed = min(u, 0).mul(0.22)
  return shore.add(inland).add(dome).add(bed)
}

/** Mottled dry-sand albedo, also used for the floor seen through the water. */
const beachSandAlbedoNode = (
  positionXZ: Node<'vec2'>,
  uniforms: BeachUniforms,
  noiseMap: THREE.Texture
): Node<'vec3'> => {
  const grain = fbmNode(positionXZ.mul(2.4), noiseMap)
  const fineGrain = fbmNode(positionXZ.mul(11).add(vec2(4.2, -7.3)), noiseMap)
  return uniforms.sand.mul(float(0.78).add(grain.mul(0.34)).add(fineGrain.mul(0.12)))
}

/** Sand normal from the beach slope plus shore-parallel ripple bands. */
const beachSandNormalNode = (
  positionXZ: Node<'vec2'>,
  radius: Node<'float'>,
  u: Node<'float'>,
  distance: Node<'float'>,
  noiseMap: THREE.Texture
): Node<'vec3'> => {
  const epsilon = 0.35
  const slope = beachHeightNode(u.add(epsilon)).sub(beachHeightNode(u)).div(epsilon)
  const radial = positionXZ.div(radius)
  const base = normalize(vec3(slope.mul(radial.x), 1, slope.mul(radial.y)))

  const warp = fbmNode(positionXZ.mul(0.7), noiseMap)
  const rippleFade = float(1).sub(smoothstep(8, 26, distance))
  const ripples = sin(u.mul(6.5).add(warp.mul(6))).mul(rippleFade).mul(0.16)
  const crossRipples = sin(
    u.mul(2.1).sub(positionXZ.x.mul(1.3).add(positionXZ.y.mul(0.9)))
  ).mul(0.05)
  const tangent = vec3(radial.y.negate(), 0, radial.x)

  return normalize(
    base.add(vec3(radial.x, 0, radial.y).mul(ripples)).add(tangent.mul(crossRipples))
  )
}

interface SwellComponent {
  wavelength: number
  amplitude: number
  /** Angle between the wave direction and the inward shore normal. */
  skew: number
}

const SWELLS: SwellComponent[] = [
  { wavelength: 44, amplitude: 0.14, skew: 0.16 },
  { wavelength: 27, amplitude: 0.09, skew: -0.42 },
  { wavelength: 16, amplitude: 0.055, skew: 0.78 }
]

/** Swells rolling towards the shore, plus their height gradient. */
const beachSwellNodes = (
  positionXZ: Node<'vec2'>,
  timeNode: Node<'float'>
): { height: Node<'float'>; gradient: Node<'vec2'> } => {
  const radius = max(length(positionXZ), 0.001)
  const inward = positionXZ.div(radius).negate()
  const tangent = vec2(inward.y.negate(), inward.x)

  let height: Node<'float'> = float(0)
  let gradient: Node<'vec2'> = vec2(0)

  SWELLS.forEach(({ wavelength, amplitude, skew }) => {
    const waveDirection = inward.mul(Math.cos(skew)).add(tangent.mul(Math.sin(skew)))
    const waveNumber = (2 * Math.PI) / wavelength
    const omega = Math.sqrt(9.81 * waveNumber) * 0.8
    const phase = dot(positionXZ, waveDirection).mul(waveNumber).add(timeNode.mul(omega))

    height = height.add(sin(phase).mul(amplitude))
    gradient = gradient.add(waveDirection.mul(cos(phase)).mul(amplitude * waveNumber))
  })

  const u = float(BEACH_RADIUS).sub(radius)
  const shoal = smoothstep(-300, -25, u)
  const swash = float(1).sub(smoothstep(-1.4, -0.04, u))

  return {
    height: height.mul(shoal.mul(swash)),
    gradient: gradient.mul(shoal.mul(swash))
  }
}

/**
 * Swash travelling along the beach, so the run-up arrives as separate
 * tongues of water instead of a single ring-wide pulse.
 */
const beachSwashNodes = (
  positionXZ: Node<'vec2'>,
  timeNode: Node<'float'>
): { phase: Node<'float'>; peak: Node<'float'> } => {
  const radius = max(length(positionXZ), 0.001)
  const inward = positionXZ.div(radius).negate()
  const tangent = vec2(inward.y.negate(), inward.x)
  const direction = normalize(inward.mul(0.55).add(tangent.mul(0.84)))
  const waveNumber = (2 * Math.PI) / 31
  const phase = dot(positionXZ, direction).mul(waveNumber).add(timeNode.mul(1.15))

  return {
    phase,
    peak: pow(max(sin(phase), 0), 3)
  }
}

/** Water surface height and slope, including the run-up on the sand. */
const beachWaterLevelNode = (
  positionXZ: Node<'vec2'>,
  timeNode: Node<'float'>
): { height: Node<'float'>; gradient: Node<'vec2'> } => {
  const radius = max(length(positionXZ), 0.001)
  const u = float(BEACH_RADIUS).sub(radius)
  const swell = beachSwellNodes(positionXZ, timeNode)
  const swash = beachSwashNodes(positionXZ, timeNode)

  const runup = swash.peak
    .mul(0.5)
    .mul(exp(max(u, 0).negate().div(2.6)))
    .mul(smoothstep(-2.6, -0.4, u))
    .mul(float(1).sub(smoothstep(3.5, 7, u)))

  return {
    height: swell.height.add(runup).add(0.012),
    gradient: swell.gradient
  }
}

/**
 * Footprint mask for the sand shader: reads the ring buffer and rebuilds a
 * heel + forefoot shape per foot in shore coordinates. Footprints fade out
 * once the swash has washed over them.
 */
const beachFootprintMaskNode = (
  positionXZ: Node<'vec2'>,
  uInland: Node<'float'>,
  wetExtent: Node<'float'>,
  uniforms: BeachUniforms,
  footprintTexture: THREE.DataTexture
): Node<'float'> => {
  const theta = atan(positionXZ.y, positionXZ.x)
  const s = theta.add(Math.PI).div(2 * Math.PI).mul(BEACH_CIRCUMFERENCE)
  const mask = float(0).toVar()

  Loop(BEACH_FOOTPRINT_CAPACITY, ({ i }) => {
    const texel = texture(
      footprintTexture,
      vec2(float(i).add(0.5).div(BEACH_FOOTPRINT_CAPACITY), 0.5)
    )
    const age = uniforms.time.sub(texel.w)
    const alive = step(float(0), age)
    const life = float(1).sub(
      smoothstep(BEACH_FOOTPRINT_LIFETIME - 60, BEACH_FOOTPRINT_LIFETIME, age)
    )

    const ds = fract(s.sub(texel.x).div(BEACH_CIRCUMFERENCE).add(0.5))
      .sub(0.5)
      .mul(BEACH_CIRCUMFERENCE)
    const du = uInland.sub(texel.y)
    const heading = texel.z
    const forward = ds.mul(cos(heading)).add(du.mul(sin(heading)))
    const lateral = du.mul(cos(heading)).sub(ds.mul(sin(heading)))

    // Slight scalloping along the toe edge reads as five toes at this scale.
    const toeEdge = forward.sub(0.058).div(0.088).add(cos(lateral.mul(150)).mul(0.05))
    const forefoot = length(vec2(toeEdge, lateral.div(0.052)))
    const heel = length(vec2(forward.add(0.086).div(0.046), lateral.div(0.038)))
    const shape = float(1).sub(smoothstep(0.84, 1.08, min(forefoot, heel)))

    const wash = smoothstep(wetExtent.sub(0.35), wetExtent.add(1.1), uInland)
    mask.addAssign(shape.mul(life).mul(alive).mul(wash))
  })

  return clamp(mask, 0, 1)
}

/** Wet sand: damp band, tinted footprints, foam residue and a wet sheen. */
const beachSandShadeNode = (
  worldPosition: Node<'vec3'>,
  uniforms: BeachUniforms,
  noiseMap: THREE.Texture,
  footprintTexture: THREE.DataTexture
): Node<'vec3'> => {
  const radius = max(length(worldPosition.xz), 0.001)
  const u = float(BEACH_RADIUS).sub(radius)
  const distance = length(cameraPosition.sub(worldPosition))

  // The wetted edge lags the current run-up, like sand drying behind a wave.
  const swash = beachSwashNodes(worldPosition.xz, uniforms.time)
  const laggedPeak = pow(max(sin(swash.phase.sub(0.75)), 0), 3)
  const wetExtent = float(0.35).add(laggedPeak.mul(2.7))

  let color = beachSandAlbedoNode(worldPosition.xz, uniforms, noiseMap)

  const wetMask = float(1).sub(smoothstep(wetExtent, wetExtent.add(2.6), u))
  const dampMask = float(1).sub(smoothstep(wetExtent.add(2.2), wetExtent.add(7), u))
  color = color.mul(float(1).sub(dampMask.mul(0.16)).sub(wetMask.mul(0.34)))

  const footprint = beachFootprintMaskNode(
    worldPosition.xz,
    u,
    wetExtent,
    uniforms,
    footprintTexture
  )
  color = color.mul(float(1).sub(footprint.mul(0.3)))

  // Lace of foam left behind by the retreating swash.
  const residueNoise = fbmNode(
    worldPosition.xz.mul(2.3).add(vec2(11.3, -4.7)),
    noiseMap
  )
  const residueBand = float(1).sub(smoothstep(0.05, 1.1, u.sub(wetExtent).abs()))
  const residue = smoothstep(0.44, 0.62, residueNoise).mul(residueBand).mul(0.45)
  color = mix(color, vec3(0.86, 0.88, 0.89), residue)

  const normal = beachSandNormalNode(worldPosition.xz, radius, u, distance, noiseMap)
  const view = normalize(cameraPosition.sub(worldPosition))
  const wet = clamp(wetMask.add(footprint.mul(0.65)), 0, 1)
  const fresnel = pow(float(1).sub(clamp(dot(view, normal), 0, 1)), 5).mul(0.9)
  color = mix(color, vec3(0.6, 0.7, 0.82), wet.mul(fresnel.add(0.035)))

  const sunDiffuse = max(dot(normal, uniforms.sunDirection), 0)
  const ambient = mix(vec3(0.52, 0.56, 0.64), vec3(0.045, 0.06, 0.1), uniforms.night)
  const direct = uniforms.sunColor.mul(sunDiffuse.mul(uniforms.sunLight).mul(0.85))
  color = color.mul(ambient.add(direct))

  const sparkle = pow(
    max(dot(reflect(view.negate(), normal), uniforms.sunDirection), 0),
    26
  )
  color = color.add(
    uniforms.sunColor.mul(
      sparkle
        .mul(residueNoise)
        .mul(uniforms.sunLight)
        .mul(float(1).sub(wet))
        .mul(float(1).sub(smoothstep(40, 160, distance)))
        .mul(0.24)
    )
  )

  return color
}

/** Ocean surface: depth-absorbed sand, glitter and foam. */
const beachWaterShadeNode = (
  worldPosition: Node<'vec3'>,
  uniforms: BeachUniforms,
  noiseMap: THREE.Texture
): Node<'vec3'> => {
  const radius = max(length(worldPosition.xz), 0.001)
  const distance = length(cameraPosition.sub(worldPosition))

  const level = beachWaterLevelNode(worldPosition.xz, uniforms.time)
  const bed = beachHeightNode(float(BEACH_RADIUS).sub(radius))
  const depth = max(level.height.sub(bed), 0)

  // Far swells are smaller than a pixel and turn into crawling stripes, so
  // their slope contribution is faded out with distance.
  const slopeFade = float(1).sub(smoothstep(70, 280, distance))

  const micro = microGradientNode(
    worldPosition.xz,
    distance,
    uniforms.time,
    noiseMap
  )
  const normal = normalize(
    vec3(
      level.gradient.x.mul(slopeFade).add(micro.x).negate(),
      1,
      level.gradient.y.mul(slopeFade).add(micro.y).negate()
    )
  )
  const view = normalize(cameraPosition.sub(worldPosition))

  const sunDiffuse = max(dot(normal, uniforms.sunDirection), 0)
  const ambient = mix(vec3(0.26, 0.32, 0.42), vec3(0.02, 0.03, 0.06), uniforms.night)
  const bedLight = ambient.mul(1.4).add(
    uniforms.sunColor.mul(sunDiffuse.mul(uniforms.sunLight).mul(0.55))
  )
  const absorption = vec3(
    exp(depth.mul(-0.6)),
    exp(depth.mul(-0.18)),
    exp(depth.mul(-0.13))
  )
  const bedColor = beachSandAlbedoNode(worldPosition.xz, uniforms, noiseMap)
    .mul(bedLight)
    .mul(absorption)

  const bodyMix = smoothstep(1, 42, depth)
  const body = mix(uniforms.waterShallow.mul(0.95), uniforms.waterDeep, bodyMix)
  const seeFloor = exp(depth.mul(-0.7))

  let color: Node<'vec3'> = mix(body, bedColor, seeFloor)

  // Sun glitter: a tight sparkling core inside a broad, soft path. Both are
  // damped with distance so the highlights do not blow out into white bands.
  const sunReflect = reflect(view.negate(), normal)
  const alignment = max(dot(sunReflect, uniforms.sunDirection), 0)
  const glitterFade = float(1).sub(smoothstep(90, 320, distance))
  const sparkle = pow(alignment, 170).mul(2).mul(glitterFade)
  const path = pow(alignment, 24).mul(0.24).mul(glitterFade)
  color = color.add(
    uniforms.sunColor
      .mul(sparkle.add(path))
      .mul(uniforms.sunLight)
      .mul(float(1).sub(uniforms.night.mul(0.7)))
  )

  // Foam: bubble lace in the shallows, cresting lines and specks offshore.
  const foamNoise = fbmNode(
    worldPosition.xz
      .mul(2.6)
      .add(vec2(uniforms.time.mul(0.02), uniforms.time.mul(-0.013))),
    noiseMap
  )
  const bubbleNoise = fbmNode(
    worldPosition.xz
      .mul(9)
      .sub(vec2(uniforms.time.mul(0.03), uniforms.time.mul(0.02))),
    noiseMap
  )
  const lace = smoothstep(0.46, 0.56, foamNoise)
  const bubbles = smoothstep(0.56, 0.66, bubbleNoise)
  // Reversed edges are written as `1 - smoothstep` because WGSL leaves
  // smoothstep undefined when the low edge is above the high edge.
  const shoreBand = float(1).sub(smoothstep(0.02, 1.6, depth))
  const crest = smoothstep(0.1, 0.2, level.height).mul(
    float(1).sub(smoothstep(2, 14, depth))
  )
  const foam = clamp(
    shoreBand
      .mul(float(0.12).add(lace.mul(0.8)))
      .add(bubbles.mul(shoreBand).mul(0.35))
      .add(crest.mul(0.1)),
    0,
    0.94
  )
  const foamColor = mix(vec3(0.9, 0.93, 0.95), vec3(0.1, 0.13, 0.18), uniforms.night)
  const foamLight = ambient.mul(1.5).add(
    uniforms.sunColor.mul(sunDiffuse.mul(uniforms.sunLight).mul(0.45))
  )
  color = mix(color, foamColor.mul(foamLight.add(0.16)), foam)

  return color
}

/**
 * Single-pass scene: sphere-trace the sand heightfield, intersect the wave
 * surface, and shade the nearest hit. Only sand and water are shaded; rays
 * that miss both are filled with the Scene background colour.
 */
const beachSceneColorNode = (
  direction: Node<'vec3'>,
  uniforms: BeachUniforms,
  noiseMap: THREE.Texture,
  footprintTexture: THREE.DataTexture
): Node<'vec4'> => {
  const dir = normalize(direction)
  const rayOrigin = cameraPosition

  const terrainHit = float(0).toVar()
  // Starts far away so a ray that hits only the ocean still picks water.
  const terrainT = float(1e6).toVar()
  const waterT = float(1e6).toVar()

  If(dir.y.lessThan(0.22), () => {
    const marchT = float(0.06).toVar()
    Loop(140, () => {
      If(terrainHit.lessThan(0.5).and(marchT.lessThan(170)), () => {
        const p = rayOrigin.add(dir.mul(marchT))
        const height = beachHeightNode(float(BEACH_RADIUS).sub(length(p.xz)))
        const above = p.y.sub(height)
        If(above.lessThan(0.002), () => {
          terrainHit.assign(1)
          terrainT.assign(marchT)
        })
        marchT.addAssign(max(above.mul(0.6), 0.05))
      })
    })
  })

  If(dir.y.lessThan(-0.0003), () => {
    // Intersect the mean water plane, then apply a single bounded correction
    // towards the wave surface. A fixed-point loop around the wave height
    // amplifies float rounding at grazing angles, which shows up as hard
    // horizontal bands and differs between the WebGPU and WebGL backends.
    const planeT = float(0).sub(rayOrigin.y).div(dir.y)
    const planePoint = rayOrigin.add(dir.mul(planeT))
    const level = beachWaterLevelNode(planePoint.xz, uniforms.time).height
    const shift = clamp(level.div(dir.y), -14, 0)
    waterT.assign(max(planeT.add(shift), 0))
  })

  const color = vec3(0).toVar()
  const shaded = float(0).toVar()

  If(waterT.lessThan(terrainT), () => {
    const waterPoint = rayOrigin.add(dir.mul(waterT))
    color.assign(beachWaterShadeNode(waterPoint, uniforms, noiseMap))
    shaded.assign(1)
  }).Else(() => {
    If(terrainHit.greaterThan(0.5), () => {
      const sandPoint = rayOrigin.add(dir.mul(terrainT))
      color.assign(
        beachSandShadeNode(sandPoint, uniforms, noiseMap, footprintTexture)
      )
      shaded.assign(1)
    })
  })

  // The background fill is not tone-mapped, so it matches the Scene clear
  // colour exactly. The material stays opaque: nothing relies on the canvas
  // alpha channel any more, which behaves differently per backend.
  return vec4(
    mix(uniforms.background, beachToneMapNode(color, uniforms.exposure), shaded),
    1
  )
}

export interface CreateBeachMaterialsOptions {
  uniforms: BeachUniforms
  noiseMap: THREE.Texture
  footprintTexture: THREE.DataTexture
}

export interface BeachMaterials {
  sky: MeshBasicNodeMaterial
}

/** Creates the single node material that raymarches the whole beach. */
export function createBeachMaterials({
  uniforms,
  noiseMap,
  footprintTexture
}: CreateBeachMaterialsOptions): BeachMaterials {
  const sky = new MeshBasicNodeMaterial({ name: 'SandyBeachSky' })
  sky.side = THREE.BackSide
  // Opaque: rays that miss sand and water are filled with the background
  // uniform inside the shader, so no alpha compositing takes place.
  sky.transparent = false
  sky.depthWrite = false
  sky.depthTest = false
  sky.colorNode = Fn(() =>
    beachSceneColorNode(
      normalize(positionWorld.sub(cameraPosition)),
      uniforms,
      noiseMap,
      footprintTexture
    )
  )()

  return { sky }
}
