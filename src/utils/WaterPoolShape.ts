import * as THREE from 'three'

/**
 * Convex outline shared by the water pool geometry and its shaders.
 *
 * The container is described by a convex polygon in the XZ plane, given
 * counter-clockwise. Every edge is stored as an inward half-plane, which keeps
 * both the CPU clamping and the fragment shader ray intersection exact and
 * cheap.
 */
export type WaterPoolOutline = ReadonlyArray<readonly [number, number]>

/**
 * Built-in container shapes. Pass an outline or a `THREE.BufferGeometry` (for
 * example a `ConvexGeometry`) for a custom pool; geometry vertices are
 * projected onto the XZ plane and reduced to their convex hull.
 */
export type WaterPoolShape = 'box' | WaterPoolOutline | THREE.BufferGeometry

/** Default square outline: `x` and `z` from -1 to 1, counter-clockwise. */
export const WATER_POOL_BOX_OUTLINE: WaterPoolOutline = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1]
]

/**
 * Irregular cube outline used by the `WaterPool` component by default: a skewed
 * quadrilateral with four sides of different lengths and no right angles, so
 * the water reads as a slightly distorted block instead of a square. It stays
 * centred on the origin and inside -1…1 like the box outline.
 */
export const WATER_POOL_IRREGULAR_CUBE_OUTLINE: WaterPoolOutline = [
  [-0.95, -0.55],
  [0.85, -0.92],
  [0.68, 0.9],
  [-0.9, 0.62]
]

export interface WaterPoolEdge {
  /** X component of the inward facing edge normal. */
  nx: number
  /** Z component of the inward facing edge normal. */
  nz: number
  /** A point lies inside the half-plane when `nx * x + nz * z >= offset`. */
  offset: number
}

/**
 * Reduces a point set to its convex outline in the XZ plane, ordered
 * counter-clockwise when seen from above.
 */
export function convexHull2D(points: WaterPoolOutline): WaterPoolOutline {
  const unique = new Map<string, readonly [number, number]>()
  points.forEach(([x, z]) => {
    if (Number.isFinite(x) && Number.isFinite(z)) {
      unique.set(`${x},${z}`, [x, z])
    }
  })
  const sorted = [...unique.values()].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  if (sorted.length <= 3) return sorted

  const cross = (
    origin: readonly [number, number],
    a: readonly [number, number],
    b: readonly [number, number]
  ) => (a[0] - origin[0]) * (b[1] - origin[1]) - (a[1] - origin[1]) * (b[0] - origin[0])
  const lower: Array<readonly [number, number]> = []
  sorted.forEach((point) => {
    while (
      lower.length >= 2 &&
      cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0
    ) {
      lower.pop()
    }
    lower.push(point)
  })
  const upper: Array<readonly [number, number]> = []
  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    const point = sorted[index]
    while (
      upper.length >= 2 &&
      cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0
    ) {
      upper.pop()
    }
    upper.push(point)
  }
  lower.pop()
  upper.pop()
  return lower.concat(upper)
}

/** Returns true when a convex outline contains the origin, including its edge. */
function outlineContainsOrigin(outline: WaterPoolOutline): boolean {
  return createWaterPoolEdges(outline).every((edge) => edge.offset <= 1e-6)
}

/** Resolves a built-in outline, convex outline or geometry to a convex hull. */
export function resolveWaterPoolShape(
  shape: WaterPoolShape = WATER_POOL_IRREGULAR_CUBE_OUTLINE
): WaterPoolOutline {
  let outline: WaterPoolOutline
  if (shape === 'box') {
    outline = WATER_POOL_BOX_OUTLINE
  } else if (shape instanceof THREE.BufferGeometry) {
    const positions = shape.getAttribute('position')
    const points: Array<readonly [number, number]> = []
    if (positions) {
      for (let index = 0; index < positions.count; index += 1) {
        points.push([positions.getX(index), positions.getZ(index)])
      }
    }
    outline = convexHull2D(points)
  } else {
    outline = convexHull2D(shape)
  }

  if (
    outline.length < 3 ||
    outline.some(
      ([x, z]) => !Number.isFinite(x) || !Number.isFinite(z) || Math.abs(x) > 1 || Math.abs(z) > 1
    ) ||
    !outlineContainsOrigin(outline)
  ) {
    throw new Error(
      '[three-vue3] Water pool shape must be a convex XZ polygon with at least three vertices inside -1…1 that contains the origin'
    )
  }
  return outline
}

/** Creates inward-facing half-planes for a counter-clockwise convex outline. */
export function createWaterPoolEdges(outline: WaterPoolOutline): WaterPoolEdge[] {
  return outline.map((start, index) => {
    const end = outline[(index + 1) % outline.length]
    const dx = end[0] - start[0]
    const dz = end[1] - start[1]
    const inverseLength = 1 / Math.max(1e-6, Math.hypot(dx, dz))
    // The inside is on the left of a counter-clockwise XZ outline.
    const nx = -dz * inverseLength
    const nz = dx * inverseLength
    return { nx, nz, offset: nx * start[0] + nz * start[1] }
  })
}

export interface WaterPoolBounds {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

/** World-independent bounds of the normalized pool outline. */
export function getWaterPoolBounds(outline: WaterPoolOutline): WaterPoolBounds {
  return outline.reduce<WaterPoolBounds>(
    (bounds, [x, z]) => ({
      minX: Math.min(bounds.minX, x),
      maxX: Math.max(bounds.maxX, x),
      minZ: Math.min(bounds.minZ, z),
      maxZ: Math.max(bounds.maxZ, z)
    }),
    { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity }
  )
}

/** Tests a point against every inward half-plane of the pool. */
export function isInsideWaterPool(
  x: number,
  z: number,
  edges: readonly WaterPoolEdge[],
  margin = 0
): boolean {
  return edges.every((edge) => edge.nx * x + edge.nz * z - edge.offset >= margin)
}

/**
 * Clamps a point to the convex pool. Half-plane projection normally converges
 * in one or two iterations; the small loop also handles points near corners.
 */
export function clampToWaterPool(
  x: number,
  z: number,
  edges: readonly WaterPoolEdge[],
  margin = 0
): [number, number] {
  let clampedX = x
  let clampedZ = z
  for (let iteration = 0; iteration < 8; iteration += 1) {
    let changed = false
    edges.forEach((edge) => {
      const signedDistance = edge.nx * clampedX + edge.nz * clampedZ - edge.offset
      if (signedDistance < margin) {
        const correction = margin - signedDistance
        clampedX += edge.nx * correction
        clampedZ += edge.nz * correction
        changed = true
      }
    })
    if (!changed) break
  }
  return [clampedX, clampedZ]
}

/** Uniformly samples every outline edge, without duplicating its vertices. */
export function sampleWaterPoolOutline(
  outline: WaterPoolOutline,
  segmentsPerEdge: number
): Array<[number, number]> {
  const points: Array<[number, number]> = []
  outline.forEach((start, index) => {
    const end = outline[(index + 1) % outline.length]
    for (let segment = 0; segment < segmentsPerEdge; segment += 1) {
      const t = segment / segmentsPerEdge
      points.push([
        THREE.MathUtils.lerp(start[0], end[0], t),
        THREE.MathUtils.lerp(start[1], end[1], t)
      ])
    }
  })
  return points
}
