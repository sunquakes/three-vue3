import * as THREE from 'three'
import { MeshBasicNodeMaterial, type Node } from 'three/webgpu'
import {
  Fn,
  If,
  abs,
  atan,
  cameraPosition,
  clamp,
  dot,
  float,
  frontFacing,
  length,
  max,
  min,
  mix,
  normalize,
  positionLocal,
  positionWorld,
  pow,
  reflect,
  refract,
  select,
  sign,
  smoothstep,
  sqrt,
  texture,
  vec2,
  vec3
} from 'three/tsl'
import { WATER_POOL_EDGES } from './WaterPoolShape'

/**
 * Ray traced materials for the interactive water pool.
 *
 * The shading follows Evan Wallace's original webgl-water demo: the water
 * surface, the tiled basin and the floating boxes are all shaded in the
 * fragment shader with analytic rays, so the effect renders identically with
 * the WebGPU and the WebGL backend and does not need any render targets.
 *
 * @see https://madebyevan.com/webgl-water/
 */
export interface WaterPoolBoxNodes {
  /** Uniform holding the world position of the box center. */
  center: Node<'vec3'>
  /** Uniform holding the box half extents. */
  halfSize: Node<'vec3'>
  /** Uniform holding the box color. */
  color: Node<'vec3'>
}

export interface WaterPoolMaterialOptions {
  /** Half float RGBA texture: height, velocity, normal.x, normal.z. */
  waterTexture: THREE.Texture
  /** RGBA texture storing the caustic light map in the red channel. */
  causticTexture: THREE.Texture
  /** Tile texture used by the basin floor and walls. */
  tileTexture: THREE.Texture
  /** Boxes floating in the pool, sharing the same ray traced shading. */
  boxes: WaterPoolBoxNodes[]
  /** Uniform holding the normalized direction towards the sun. */
  lightDirection: Node<'vec3'>
}

export interface WaterPoolMaterials {
  water: MeshBasicNodeMaterial
  pool: MeshBasicNodeMaterial
  boxes: MeshBasicNodeMaterial[]
  sky: MeshBasicNodeMaterial
}

const IOR_AIR = 1
const IOR_WATER = 1.333
const SURFACE_TO_AIR = IOR_AIR / IOR_WATER
const AIR_TO_SURFACE = IOR_WATER / IOR_AIR
const POOL_FLOOR_Y = -1
const POOL_RIM_Y = 1 / 6
const RAY_MISS = 1e6

/**
 * Absorption applied to light that travels through the water. It is kept mild
 * so that the different box colors stay readable under the surface, and it is
 * only applied once per ray (applying it twice crushes the red channel and
 * turns every box blue).
 */
const waterTintColor = vec3(0.7, 0.92, 1.0)
const underwaterTintColor = vec3(0.62, 0.86, 1.0)

interface ShadingContext {
  waterTexture: THREE.Texture
  causticTexture: THREE.Texture
  tileTexture: THREE.Texture
  boxes: WaterPoolBoxNodes[]
  lightDirection: Node<'vec3'>
}

/** Direction the sunlight travels after entering the flat water surface. */
function refractedSunlightNode(lightDirection: Node<'vec3'>): Node<'vec3'> {
  return refract(lightDirection.negate(), vec3(0, 1, 0), SURFACE_TO_AIR)
}

/**
 * Surface coordinate that the refracted sunlight reaching `point` passed
 * through. The caustic map is indexed by surface coordinate, so a floor point
 * looks up the map exactly where its own sun ray entered the water.
 */
function causticUvNode(point: Node<'vec3'>, lightDirection: Node<'vec3'>): Node<'vec2'> {
  const refracted = refractedSunlightNode(lightDirection)
  return point.xz.sub(refracted.xz.mul(point.y).div(refracted.y)).mul(0.5).add(0.5)
}

/** Procedural sky used by the background dome and by the water reflections. */
export function waterPoolSkyColorNode(
  ray: Node<'vec3'>,
  lightDirection: Node<'vec3'>
): Node<'vec3'> {
  const height = clamp(ray.y, -1, 1)
  const gradient = mix(vec3(0.58, 0.76, 0.94), vec3(0.16, 0.42, 0.78), smoothstep(0, 0.65, height))
  const horizonGlow = mix(
    vec3(0.92, 0.9, 0.82),
    vec3(0, 0, 0),
    smoothstep(0, 0.22, abs(height))
  ).mul(0.35)
  const sunAlignment = max(dot(ray, lightDirection), 0)
  const sunDisc = pow(sunAlignment, 1400).mul(6)
  const sunHalo = pow(sunAlignment, 28).mul(0.28)

  return gradient
    .add(horizonGlow)
    .add(vec3(1.0, 0.9, 0.72).mul(sunDisc))
    .add(vec3(1.0, 0.82, 0.58).mul(sunHalo))
}

/**
 * Distance along `ray` to the wall of the irregular basin, or `RAY_MISS` when
 * the ray travels straight up or down and never reaches a wall.
 *
 * The outline is convex, so clamping the positive hit of every inward
 * half-plane yields the exact exit point. Rays start on the water surface,
 * which always lies inside the outline.
 */
function intersectPoolWallNode(origin: Node<'vec3'>, ray: Node<'vec3'>): Node<'float'> {
  const wallHit = float(RAY_MISS).toVar()
  const originXZ = vec2(origin.x, origin.z)
  const directionXZ = vec2(ray.x, ray.z)

  WATER_POOL_EDGES.forEach((edge) => {
    const normal = vec2(edge.nx, edge.nz)
    const denominator = dot(normal, directionXZ)
    const distance = float(edge.offset).sub(dot(normal, originXZ)).div(denominator)
    const valid = denominator
      .lessThan(-1e-5)
      .and(distance.greaterThan(0))
      .and(distance.lessThan(wallHit))

    wallHit.assign(select(valid, distance, wallHit))
  })

  return wallHit
}

/**
 * Distance along `ray` to the near face of an axis aligned box, or `RAY_MISS`
 * when the ray does not hit it.
 */
function intersectBoxNode(
  origin: Node<'vec3'>,
  ray: Node<'vec3'>,
  center: Node<'vec3'>,
  halfSize: Node<'vec3'>
): Node<'float'> {
  const tMin = center.sub(halfSize).sub(origin).div(ray)
  const tMax = center.add(halfSize).sub(origin).div(ray)
  const near = min(tMin, tMax)
  const far = max(tMin, tMax)
  const tNear = max(max(near.x, near.y), near.z)
  const tFar = min(min(far.x, far.y), far.z)

  return select(tNear.greaterThan(0).and(tNear.lessThan(tFar)), tNear, float(RAY_MISS))
}

/** Outward normal of the box face that contains `point`. */
function boxNormalNode(
  point: Node<'vec3'>,
  center: Node<'vec3'>,
  halfSize: Node<'vec3'>
): Node<'vec3'> {
  const local = point.sub(center)
  const distance = abs(local).div(halfSize)
  const normal = vec3(0).toVar()

  If(distance.x.greaterThan(distance.y).and(distance.x.greaterThan(distance.z)), () => {
    normal.assign(vec3(sign(local.x), 0, 0))
  })
    .ElseIf(distance.y.greaterThan(distance.z), () => {
      normal.assign(vec3(0, sign(local.y), 0))
    })
    .Else(() => {
      normal.assign(vec3(0, 0, sign(local.z)))
    })

  return normal
}

/** Shading of a floating box, matching the original sphere shading. */
function boxColorNode(
  point: Node<'vec3'>,
  box: WaterPoolBoxNodes,
  context: ShadingContext
): Node<'vec3'> {
  const halfSize = box.halfSize
  const color = box.color.toVar()

  // Ambient occlusion against the basin, mirroring the original demo.
  const aoX = float(1).sub(
    float(0.9).div(pow(float(1).add(halfSize.x).sub(abs(point.x)).div(halfSize.x), 3))
  )
  const aoZ = float(1).sub(
    float(0.9).div(pow(float(1).add(halfSize.z).sub(abs(point.z)).div(halfSize.z), 3))
  )
  const aoY = float(1).sub(float(0.9).div(pow(point.y.add(1).add(halfSize.y).div(halfSize.y), 3)))
  color.mulAssign(aoX.mul(aoZ).mul(aoY))

  const normal = boxNormalNode(point, box.center, halfSize)
  const sunlight = refractedSunlightNode(context.lightDirection).negate()
  const diffuse = max(dot(sunlight, normal), 0)
  const waterHeight = texture(context.waterTexture, point.xz.mul(0.5).add(0.5)).r
  const light = float(0.45).add(diffuse.mul(0.35)).toVar()

  If(point.y.lessThan(waterHeight), () => {
    const caustic = texture(context.causticTexture, causticUvNode(point, context.lightDirection)).r
    light.addAssign(diffuse.mul(caustic).mul(1.6))
  })
  // Modulate the box color instead of adding white light, otherwise bright
  // caustics desaturate every box into the same pale cyan.
  color.mulAssign(light)

  const viewDirection = normalize(cameraPosition.sub(point))
  const halfVector = normalize(viewDirection.add(context.lightDirection))
  const specular = pow(max(dot(normal, halfVector), 0), 96).mul(0.35)
  const reflection = waterPoolSkyColorNode(
    reflect(viewDirection.negate(), normal),
    context.lightDirection
  ).mul(0.16)
  color.addAssign(vec3(specular))
  color.addAssign(reflection)

  return color
}

/** Shading of the basin floor and walls, with caustics and box occlusion. */
function basinColorNode(point: Node<'vec3'>, context: ShadingContext): Node<'vec3'> {
  const color = vec3(0).toVar()
  const normal = vec3(0).toVar()
  // The floor and the walls darken towards the rim, while the deck around the
  // pool keeps the brightness of the tiled texture.
  const scale = float(0.5).div(length(point)).toVar()

  // The deck lies at the rim height, the floor is a flat disc at the bottom and
  // the walls rise between them, so the height alone separates the three
  // surfaces of the irregular basin.
  If(point.y.greaterThan(POOL_RIM_Y - 0.005), () => {
    color.assign(texture(context.tileTexture, point.xz.mul(0.5).add(0.5)).rgb)
    normal.assign(vec3(0, 1, 0))
    scale.assign(1)
  })
    .ElseIf(point.y.lessThan(POOL_FLOOR_Y + 0.005), () => {
      color.assign(texture(context.tileTexture, point.xz.mul(0.5).add(0.5)).rgb)
      normal.assign(vec3(0, 1, 0))
    })
    .Else(() => {
      // Arc length around the outline drives the horizontal tile coordinate so
      // the mosaic keeps roughly the same size as on the floor.
      const wallUv = vec2(atan(point.z, point.x).mul(0.44).add(1), point.y.mul(0.5).add(0.5))
      color.assign(texture(context.tileTexture, wallUv).rgb)
      normal.assign(normalize(vec3(point.x.negate(), 0, point.z.negate())))
    })

  // Darken the basin right below a box, using the nearest box surface.
  const boxDistance = float(1e6).toVar()
  context.boxes.forEach((box) => {
    boxDistance.assign(min(boxDistance, length(point.sub(box.center).div(box.halfSize))))
  })
  scale.mulAssign(float(1).sub(float(0.9).div(pow(max(boxDistance, 1), 4))))

  const sunlight = refractedSunlightNode(context.lightDirection).negate()
  const diffuse = max(dot(sunlight, normal), 0)
  const waterHeight = texture(context.waterTexture, point.xz.mul(0.5).add(0.5)).r

  If(point.y.lessThan(waterHeight), () => {
    const caustic = texture(context.causticTexture, causticUvNode(point, context.lightDirection)).r
    // Every box blocks the refracted sunlight and casts a soft shadow on the
    // basin, which also darkens the part of the caustic web behind it.
    const shadow = float(1).toVar()
    context.boxes.forEach((box) => {
      const toBox = box.center.sub(point)
      const alongSun = max(dot(toBox, sunlight), 0)
      const perpendicular = length(toBox.sub(sunlight.mul(alongSun)))
      const radius = length(box.halfSize)
      shadow.mulAssign(
        mix(float(0.35), float(1), smoothstep(radius.mul(0.7), radius.mul(1.45), perpendicular))
      )
    })
    scale.addAssign(diffuse.mul(caustic).mul(2).mul(shadow))
  }).Else(() => {
    scale.addAssign(diffuse.mul(0.35))
  })

  return color.mul(scale)
}

/**
 * Color seen when a water ray leaves the surface, tracing the boxes, the basin
 * walls or the sky depending on where the ray goes.
 */
function surfaceRayColorNode(
  origin: Node<'vec3'>,
  ray: Node<'vec3'>,
  context: ShadingContext
): Node<'vec3'> {
  const color = vec3(0).toVar()
  const nearest = float(RAY_MISS).toVar()
  const hitColor = vec3(0).toVar()

  context.boxes.forEach((box) => {
    const boxHit = intersectBoxNode(origin, ray, box.center, box.halfSize)
    If(boxHit.lessThan(nearest), () => {
      nearest.assign(boxHit)
      hitColor.assign(boxColorNode(origin.add(ray.mul(boxHit)), box, context))
    })
  })

  If(nearest.lessThan(RAY_MISS * 0.5), () => {
    color.assign(hitColor)
  }).Else(() => {
    const wallHit = intersectPoolWallNode(origin, ray)

    If(ray.y.lessThan(0), () => {
      // Downward rays hit the flat floor unless the irregular wall is closer.
      const floorHit = float(POOL_FLOOR_Y).sub(origin.y).div(ray.y)
      If(wallHit.lessThan(floorHit), () => {
        color.assign(basinColorNode(origin.add(ray.mul(wallHit)), context))
      }).Else(() => {
        color.assign(basinColorNode(origin.add(ray.mul(floorHit)), context))
      })
    }).Else(() => {
      // Upward rays either graze a wall below the rim or escape to the sky
      // through the open top of the pool.
      const rimHit = float(POOL_RIM_Y).sub(origin.y).div(ray.y)
      If(wallHit.lessThan(rimHit), () => {
        color.assign(basinColorNode(origin.add(ray.mul(wallHit)), context))
      }).Else(() => {
        color.assign(waterPoolSkyColorNode(ray, context.lightDirection))
      })
    })
  })

  // Absorb the light exactly once for rays travelling through the water, so a
  // refracted box is not tinted once here and again by the caller.
  If(ray.y.lessThan(0), () => {
    color.mulAssign(waterTintColor)
  })

  return color
}

/** Samples the height field and reconstructs the rippled surface normal. */
function waterNormalNode(waterTexture: THREE.Texture): Node<'vec3'> {
  let coord: Node<'vec2'> = positionWorld.xz.mul(0.5).add(0.5)
  let info = texture(waterTexture, coord)

  // The original demo walks a few steps along the normal so that ripples read
  // as sharp peaks instead of soft bumps.
  for (let index = 0; index < 5; index += 1) {
    coord = coord.add(vec2(info.b, info.a).mul(0.005))
    info = texture(waterTexture, coord)
  }

  const normalX = info.b
  const normalZ = info.a
  const normalY = sqrt(max(float(1).sub(normalX.mul(normalX)).sub(normalZ.mul(normalZ)), 0))

  return vec3(normalX, normalY, normalZ)
}

/** Creates all node materials used by the water pool. */
export function createWaterPoolMaterials(options: WaterPoolMaterialOptions): WaterPoolMaterials {
  const context: ShadingContext = {
    waterTexture: options.waterTexture,
    causticTexture: options.causticTexture,
    tileTexture: options.tileTexture,
    boxes: options.boxes,
    lightDirection: options.lightDirection
  }

  const water = new MeshBasicNodeMaterial()
  water.name = 'WaterPoolSurface'
  water.side = THREE.DoubleSide
  water.positionNode = Fn(() => {
    const uvCoord = positionLocal.xz.mul(0.5).add(0.5)
    const height = texture(context.waterTexture, uvCoord).r

    return vec3(positionLocal.x, height, positionLocal.z)
  })()
  water.colorNode = Fn(() => {
    const incomingRay = normalize(positionWorld.sub(cameraPosition))
    const normal = waterNormalNode(context.waterTexture)
    const color = vec3(0).toVar()

    If(frontFacing, () => {
      const reflectedRay = reflect(incomingRay, normal)
      const refractedRay = refract(incomingRay, normal, SURFACE_TO_AIR)
      const cosTheta = clamp(dot(normal, incomingRay.negate()), 0, 1)
      const fresnel = mix(0.08, 1, pow(float(1).sub(cosTheta), 3))
      const reflected = surfaceRayColorNode(positionWorld, reflectedRay, context)
      const refracted = surfaceRayColorNode(positionWorld, refractedRay, context)

      color.assign(mix(refracted, reflected, fresnel))
    }).Else(() => {
      const flippedNormal = normal.negate()
      const reflectedRay = reflect(incomingRay, flippedNormal)
      const refractedRay = refract(incomingRay, flippedNormal, AIR_TO_SURFACE)
      const cosTheta = clamp(dot(flippedNormal, incomingRay.negate()), 0, 1)
      const fresnel = mix(0.5, 1, pow(float(1).sub(cosTheta), 3))
      const reflected = surfaceRayColorNode(positionWorld, reflectedRay, context)
      const refracted = surfaceRayColorNode(positionWorld, refractedRay, context).mul(
        underwaterTintColor
      )

      color.assign(mix(reflected, refracted, float(1).sub(fresnel).mul(length(refractedRay))))
    })

    return color
  })()

  const pool = new MeshBasicNodeMaterial()
  pool.name = 'WaterPoolBasin'
  pool.side = THREE.DoubleSide
  pool.colorNode = Fn(() => {
    const color = basinColorNode(positionWorld, context).toVar()
    const waterHeight = texture(context.waterTexture, positionWorld.xz.mul(0.5).add(0.5)).r

    If(positionWorld.y.lessThan(waterHeight), () => {
      color.mulAssign(underwaterTintColor.mul(1.1))
    })

    return color
  })()

  const boxes = context.boxes.map((box) => {
    const material = new MeshBasicNodeMaterial()
    material.name = 'WaterPoolBox'
    material.colorNode = Fn(() => {
      const color = boxColorNode(positionWorld, box, context).toVar()
      const waterHeight = texture(context.waterTexture, positionWorld.xz.mul(0.5).add(0.5)).r

      If(positionWorld.y.lessThan(waterHeight), () => {
        color.mulAssign(underwaterTintColor.mul(1.1))
      })

      return color
    })()

    return material
  })

  const sky = new MeshBasicNodeMaterial()
  sky.name = 'WaterPoolSky'
  sky.side = THREE.BackSide
  sky.depthWrite = false
  sky.colorNode = Fn(() =>
    waterPoolSkyColorNode(normalize(positionWorld.sub(cameraPosition)), context.lightDirection)
  )()

  return { water, pool, boxes, sky }
}

/**
 * Builds a small mosaic tile texture for the basin. Generated in a canvas so
 * the component stays self contained and does not download any assets.
 */
export function createWaterPoolTileTexture(): THREE.CanvasTexture {
  const size = 512
  const tiles = 8
  const gap = 7
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('WaterPool requires a 2D canvas context to build its tile texture')
  }

  context.fillStyle = '#8fa1a1'
  context.fillRect(0, 0, size, size)

  const cell = size / tiles
  for (let row = 0; row < tiles; row += 1) {
    for (let column = 0; column < tiles; column += 1) {
      const variation = (Math.sin(row * 12.9898 + column * 78.233) * 43758.5453) % 1
      const light = 0.94 + Math.abs(variation) * 0.08
      const red = Math.round(150 * light)
      const green = Math.round(196 * light)
      const blue = Math.round(198 * light)

      context.fillStyle = `rgb(${red}, ${green}, ${blue})`
      context.fillRect(column * cell + gap * 0.5, row * cell + gap * 0.5, cell - gap, cell - gap)

      const sheen = context.createLinearGradient(
        column * cell,
        row * cell,
        column * cell + cell,
        row * cell + cell
      )
      sheen.addColorStop(0, 'rgba(255, 255, 255, 0.22)')
      sheen.addColorStop(0.55, 'rgba(255, 255, 255, 0.04)')
      sheen.addColorStop(1, 'rgba(20, 40, 50, 0.1)')
      context.fillStyle = sheen
      context.fillRect(column * cell + gap * 0.5, row * cell + gap * 0.5, cell - gap, cell - gap)
    }
  }

  const tileTexture = new THREE.CanvasTexture(canvas)
  tileTexture.colorSpace = THREE.SRGBColorSpace
  tileTexture.wrapS = THREE.RepeatWrapping
  tileTexture.wrapT = THREE.RepeatWrapping
  tileTexture.anisotropy = 4
  tileTexture.needsUpdate = true

  return tileTexture
}
