import * as THREE from 'three'
import { MeshBasicNodeMaterial, type Node } from 'three/webgpu'
import {
  Fn,
  If,
  abs,
  cameraPosition,
  clamp,
  dot,
  float,
  frontFacing,
  length,
  max,
  mix,
  normalize,
  positionLocal,
  positionWorld,
  pow,
  reflect,
  refract,
  smoothstep,
  sqrt,
  texture,
  vec2,
  vec3
} from 'three/tsl'

/**
 * Ray traced materials for the interactive water pool.
 *
 * The shading follows Evan Wallace's original webgl-water demo: the water
 * surface and the basin floor are both shaded in the fragment shader with
 * analytic rays, so the effect renders identically with the WebGPU and the
 * WebGL backend and does not need any render targets.
 *
 * @see https://madebyevan.com/webgl-water/
 */
export interface WaterPoolMaterialOptions {
  /** Half float RGBA texture: height, velocity, normal.x, normal.z. */
  waterTexture: THREE.Texture
  /** Uniform holding the normalized direction towards the sun. */
  lightDirection: Node<'vec3'>
  /** Uniform holding the world position of the pool surface centre. */
  poolCenter: Node<'vec3'>
  /** Uniform holding the uniform scale applied to the pool. */
  poolScale: Node<'float'>
}

export interface WaterPoolMaterials {
  water: MeshBasicNodeMaterial
}

const IOR_AIR = 1
const IOR_WATER = 1.333
const SURFACE_TO_AIR = IOR_AIR / IOR_WATER
const AIR_TO_SURFACE = IOR_WATER / IOR_AIR
const POOL_FLOOR_Y = -1

/**
 * Absorption applied to light that travels through the water. It is kept mild
 * so that the basin stays readable under the surface, and it is only applied
 * once per ray (applying it twice crushes the red channel and turns the basin
 * blue).
 */
const waterTintColor = vec3(0.7, 0.92, 1.0)
const underwaterTintColor = vec3(0.62, 0.86, 1.0)

interface ShadingContext {
  waterTexture: THREE.Texture
  lightDirection: Node<'vec3'>
  poolCenter: Node<'vec3'>
  poolScale: Node<'float'>
}

/**
 * World point expressed in the pool's own space, where the surface centre is
 * the origin, the floor sits at y = -1 and the outline fits into -1…1. The pool
 * mesh is a scaled and translated group, so every ray is traced in this space
 * and the shading does not depend on where the pool is placed.
 */
function poolSpacePointNode(point: Node<'vec3'>, context: ShadingContext): Node<'vec3'> {
  return point.sub(context.poolCenter).div(context.poolScale)
}

/** Direction the sunlight travels after entering the flat water surface. */
function refractedSunlightNode(lightDirection: Node<'vec3'>): Node<'vec3'> {
  return refract(lightDirection.negate(), vec3(0, 1, 0), SURFACE_TO_AIR)
}

/** Procedural sky traced by the water reflections. */
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

/** Shading of the basin floor, with distance based light falloff. */
function basinColorNode(point: Node<'vec3'>, context: ShadingContext): Node<'vec3'> {
  // Plain floor color: no tiles and no caustic net.
  const color = vec3(0.59, 0.77, 0.78)
  const normal = vec3(0, 1, 0)

  const scale = float(0.5).div(length(point)).toVar()

  const sunlight = refractedSunlightNode(context.lightDirection).negate()
  const diffuse = max(dot(sunlight, normal), 0)

  scale.addAssign(diffuse.mul(0.45))

  return color.mul(scale)
}

/**
 * Color seen when a water ray leaves the surface, tracing the basin floor or
 * the sky depending on where the ray goes.
 */
function surfaceRayColorNode(
  origin: Node<'vec3'>,
  ray: Node<'vec3'>,
  context: ShadingContext
): Node<'vec3'> {
  const color = vec3(0).toVar()

  If(ray.y.lessThan(0), () => {
    // Downward rays reach the flat basin floor. The pool has no basin wall,
    // so upward rays escape through the open top towards the sky. Absorb the
    // light exactly once for rays travelling through the water.
    const floorHit = float(POOL_FLOOR_Y).sub(origin.y).div(ray.y)
    color.assign(basinColorNode(origin.add(ray.mul(floorHit)), context).mul(waterTintColor))
  }).Else(() => {
    color.assign(waterPoolSkyColorNode(ray, context.lightDirection))
  })

  return color
}

/** Samples the height field and reconstructs the rippled surface normal. */
function waterNormalNode(waterTexture: THREE.Texture, point: Node<'vec3'>): Node<'vec3'> {
  let coord: Node<'vec2'> = point.xz.mul(0.5).add(0.5)
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
    lightDirection: options.lightDirection,
    poolCenter: options.poolCenter,
    poolScale: options.poolScale
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
    // Trace the rays in pool space, where the floor and the height field have
    // their fixed positions regardless of where the pool is placed or scaled.
    const surfacePoint = poolSpacePointNode(positionWorld, context)
    const cameraPoint = poolSpacePointNode(cameraPosition, context)
    const incomingRay = normalize(surfacePoint.sub(cameraPoint))
    const normal = waterNormalNode(context.waterTexture, surfacePoint)
    const color = vec3(0).toVar()

    If(frontFacing, () => {
      const reflectedRay = reflect(incomingRay, normal)
      const refractedRay = refract(incomingRay, normal, SURFACE_TO_AIR)
      const cosTheta = clamp(dot(normal, incomingRay.negate()), 0, 1)
      const fresnel = mix(0.08, 1, pow(float(1).sub(cosTheta), 3))
      const reflected = surfaceRayColorNode(surfacePoint, reflectedRay, context)
      const refracted = surfaceRayColorNode(surfacePoint, refractedRay, context)

      color.assign(mix(refracted, reflected, fresnel))
    }).Else(() => {
      const flippedNormal = normal.negate()
      const reflectedRay = reflect(incomingRay, flippedNormal)
      const refractedRay = refract(incomingRay, flippedNormal, AIR_TO_SURFACE)
      const cosTheta = clamp(dot(flippedNormal, incomingRay.negate()), 0, 1)
      const fresnel = mix(0.5, 1, pow(float(1).sub(cosTheta), 3))
      const reflected = surfaceRayColorNode(surfacePoint, reflectedRay, context)
      const refracted = surfaceRayColorNode(surfacePoint, refractedRay, context).mul(
        underwaterTintColor
      )

      color.assign(mix(reflected, refracted, float(1).sub(fresnel).mul(length(refractedRay))))
    })

    return color
  })()

  return { water }
}
