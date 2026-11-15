/**
 * Irregular outline shared by the water pool geometry and its shaders.
 *
 * Instead of a square tub the basin follows a convex polygon with uneven
 * edge lengths and radii, so the waterline, the tiled walls and the ray traced
 * reflections all share the same organic silhouette. Every edge of the outline
 * is stored as an inward half-plane, which keeps both the CPU clamping and the
 * fragment shader ray intersection exact and cheap.
 */
export const WATER_POOL_OUTLINE: ReadonlyArray<readonly [number, number]> = [
  [0.7534, 0.0404],
  [0.7071, 0.2695],
  [0.4604, 0.6016],
  [0.1323, 0.8947],
  [-0.1217, 0.8681],
  [-0.4869, 0.589],
  [-0.728, 0.3237],
  [-0.8493, 0.0475],
  [-0.8216, -0.4021],
  [-0.5334, -0.6252],
  [-0.128, -0.8241],
  [0.1716, -0.8038],
  [0.4642, -0.5891],
  [0.6643, -0.3302]
]

export interface WaterPoolEdge {
  /** X component of the inward facing edge normal. */
  nx: number
  /** Z component of the inward facing edge normal. */
  nz: number
  /** A point lies inside the half-plane when `nx * x + nz * z >= offset`. */
  offset: number
}

/** Inward half-planes of {@link WATER_POOL_OUTLINE}. */
export const WATER_POOL_EDGES: readonly WaterPoolEdge[] = WATER_POOL_OUTLINE.map((start, index) => {
  const end = WATER_POOL_OUTLINE[(index + 1) % WATER_POOL_OUTLINE.length]
  const edgeX = end[0] - start[0]
  const edgeZ = end[1] - start[1]
  const length = Math.hypot(edgeX, edgeZ)
  const nx = -edgeZ / length
  const nz = edgeX / length

  return { nx, nz, offset: nx * start[0] + nz * start[1] }
})

/** True when the point lies inside the pool outline, inset by `margin`. */
export function isInsideWaterPool(x: number, z: number, margin = 0): boolean {
  return WATER_POOL_EDGES.every((edge) => edge.nx * x + edge.nz * z >= edge.offset + margin)
}

/**
 * Pushes a point back inside the outline, keeping at least `margin` distance
 * from every wall. The repeat passes let a corner adjustment refine the
 * opposite edges, which converges quickly for a convex outline.
 */
export function clampToWaterPool(x: number, z: number, margin = 0): [number, number] {
  let clampedX = x
  let clampedZ = z

  for (let pass = 0; pass < 3; pass += 1) {
    WATER_POOL_EDGES.forEach((edge) => {
      const distance = edge.nx * clampedX + edge.nz * clampedZ - edge.offset
      if (distance < margin) {
        const push = margin - distance
        clampedX += edge.nx * push
        clampedZ += edge.nz * push
      }
    })
  }

  return [clampedX, clampedZ]
}

/**
 * Samples the outline as a closed ring of XZ points, with `segmentsPerEdge`
 * subdivisions on every edge so the rendered boundary matches the half-planes
 * used by the shader exactly.
 */
export function sampleWaterPoolOutline(segmentsPerEdge: number): Array<[number, number]> {
  const steps = Math.max(1, Math.round(segmentsPerEdge))
  const points: Array<[number, number]> = []

  WATER_POOL_OUTLINE.forEach((start, index) => {
    const end = WATER_POOL_OUTLINE[(index + 1) % WATER_POOL_OUTLINE.length]
    for (let step = 0; step < steps; step += 1) {
      const t = step / steps
      points.push([start[0] + (end[0] - start[0]) * t, start[1] + (end[1] - start[1]) * t])
    }
  })

  return points
}
