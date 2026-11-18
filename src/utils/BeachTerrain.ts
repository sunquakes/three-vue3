/**
 * Geometry and first-person walker for the ring-shaped beach.
 *
 * The shore is a circle of circumference `BEACH_CIRCUMFERENCE`: `u` measures
 * metres inland from the waterline, `s` measures arc length along the shore.
 * Everything is expressed in these shore coordinates so the shader and the
 * walker agree on where the wet sand and the footprints are.
 */

export const BEACH_CIRCUMFERENCE = 260
export const BEACH_RADIUS = BEACH_CIRCUMFERENCE / (2 * Math.PI)
export const BEACH_DOME_RADIUS = BEACH_RADIUS - 9
export const BEACH_DOME_HEIGHT = 1.5
export const BEACH_EYE_STANDING = 1.6
export const BEACH_EYE_CROUCHING = 0.65
export const BEACH_WALK_SPEED = 2.2
export const BEACH_U_MIN = 0.55
export const BEACH_U_MAX = 24
export const BEACH_FOOTPRINT_U_MAX = 28
export const BEACH_PITCH_MIN = -1.45
export const BEACH_PITCH_MAX = 0.5
export const BEACH_FOOTPRINT_OFFSET = 0.085
export const BEACH_FOOTPRINT_LIFETIME = 480

/** Sand height at `u` metres inland from the waterline. */
export function beachHeight(u: number): number {
  const shore = Math.min(Math.max(u, 0), 2.8) * 0.22
  const inland = Math.max(u - 2.8, 0) * 0.08
  const radius = BEACH_RADIUS - u
  const domeRatio = Math.min(Math.abs(radius) / BEACH_DOME_RADIUS, 1)
  const dome = BEACH_DOME_HEIGHT * Math.pow(1 - domeRatio * domeRatio, 2)
  const bed = Math.min(u, 0) * 0.22
  return shore + inland + dome + bed
}

export interface ShoreCoordinates {
  /** Arc length along the shore, in [0, BEACH_CIRCUMFERENCE). */
  s: number
  /** Metres inland from the waterline. Negative offshore. */
  u: number
  /** Polar angle around the island, in radians. */
  theta: number
}

export function toShoreCoordinates(x: number, z: number): ShoreCoordinates {
  const radius = Math.hypot(x, z)
  const theta = Math.atan2(z, x)
  return {
    s: ((theta + Math.PI) / (2 * Math.PI)) * BEACH_CIRCUMFERENCE,
    u: BEACH_RADIUS - radius,
    theta
  }
}

export function beachPosition(theta: number, u: number): { x: number; y: number; z: number } {
  const radius = BEACH_RADIUS - u
  return {
    x: Math.cos(theta) * radius,
    y: beachHeight(u),
    z: Math.sin(theta) * radius
  }
}

export interface BeachFootprintSample {
  s: number
  u: number
  /** Direction of travel in the (s, u) plane, in radians. */
  heading: number
  /** -1 for the left foot, +1 for the right foot. */
  side: number
}

export interface BeachWalkerInput {
  /** Forward / backward movement in [-1, 1]. */
  forward?: number
  /** Lateral movement in [-1, 1]. */
  strafe?: number
  /** Walk forward automatically even without input. */
  autoWalk?: boolean
  /** Lower the camera to a crouched eye height. */
  crouching?: boolean
}

export interface BeachWalkerFrame {
  x: number
  z: number
  theta: number
  u: number
  yaw: number
  pitch: number
  eyeHeight: number
  footprints: BeachFootprintSample[]
}

export interface BeachWalkerOptions {
  theta?: number
  u?: number
  yaw?: number
  pitch?: number
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

/**
 * First-person walker constrained to the beach ring. Keeps the camera on the
 * sand, emits footprint samples on a 0.58 / 0.72 m alternating gait and
 * smooths the crouch transition.
 */
export class BeachWalker {
  theta: number
  u: number
  yaw: number
  pitch: number
  eyeHeight = BEACH_EYE_STANDING

  private stepDistance = 0
  private nextStepLength = 0.62
  private side = 1

  constructor(options: BeachWalkerOptions = {}) {
    this.theta = options.theta ?? 0
    this.u = clamp(options.u ?? 7, BEACH_U_MIN, BEACH_U_MAX)
    this.yaw = options.yaw ?? Math.PI
    this.pitch = clamp(options.pitch ?? -0.14, BEACH_PITCH_MIN, BEACH_PITCH_MAX)
  }

  /** Applies a look drag. `deltaX` / `deltaY` are in CSS pixels. */
  setLookDelta(deltaX: number, deltaY: number, sensitivity = 0.0016): void {
    this.yaw -= deltaX * sensitivity
    this.pitch = clamp(this.pitch - deltaY * sensitivity, BEACH_PITCH_MIN, BEACH_PITCH_MAX)
  }

  update(deltaTime: number, input: BeachWalkerInput = {}): BeachWalkerFrame {
    const dt = clamp(deltaTime, 0, 0.1)
    const targetEye = input.crouching ? BEACH_EYE_CROUCHING : BEACH_EYE_STANDING
    this.eyeHeight += (targetEye - this.eyeHeight) * (1 - Math.exp(-3 * dt))

    let forward = clamp(input.forward ?? 0, -1, 1)
    const strafe = clamp(input.strafe ?? 0, -1, 1)
    if ((input.autoWalk ?? false) && Math.abs(forward) < 0.01) {
      forward = 1
    }

    const speed = BEACH_WALK_SPEED * (forward < 0 ? 0.6 : 1) * dt
    const sinYaw = Math.sin(this.yaw)
    const cosYaw = Math.cos(this.yaw)
    const oldX = Math.cos(this.theta) * (BEACH_RADIUS - this.u)
    const oldZ = Math.sin(this.theta) * (BEACH_RADIUS - this.u)
    const nextX = oldX + (-sinYaw * forward + cosYaw * strafe) * speed
    const nextZ = oldZ + (-cosYaw * forward - sinYaw * strafe) * speed

    const nextRadius = Math.hypot(nextX, nextZ)
    this.theta = Math.atan2(nextZ, nextX)
    this.u = clamp(BEACH_RADIUS - nextRadius, BEACH_U_MIN, BEACH_U_MAX)

    const x = Math.cos(this.theta) * (BEACH_RADIUS - this.u)
    const z = Math.sin(this.theta) * (BEACH_RADIUS - this.u)
    const footprints: BeachFootprintSample[] = []
    this.collectFootprints(x - oldX, z - oldZ, x, z, footprints)

    return {
      x,
      z,
      theta: this.theta,
      u: this.u,
      yaw: this.yaw,
      pitch: this.pitch,
      eyeHeight: this.eyeHeight,
      footprints
    }
  }

  private collectFootprints(
    moveX: number,
    moveZ: number,
    x: number,
    z: number,
    footprints: BeachFootprintSample[]
  ): void {
    const moved = Math.hypot(moveX, moveZ)
    if (moved < 1e-5) {
      return
    }

    this.stepDistance += moved
    const directionX = moveX / moved
    const directionZ = moveZ / moved
    const tangentX = -Math.sin(this.theta)
    const tangentZ = Math.cos(this.theta)
    const radialX = Math.cos(this.theta)
    const radialZ = Math.sin(this.theta)
    const alongShore = directionX * tangentX + directionZ * tangentZ
    const inland = -(directionX * radialX + directionZ * radialZ)
    const heading = Math.atan2(inland, alongShore)

    while (this.stepDistance >= this.nextStepLength) {
      const lateralX = -directionZ * this.side * BEACH_FOOTPRINT_OFFSET
      const lateralZ = directionX * this.side * BEACH_FOOTPRINT_OFFSET
      const coordinates = toShoreCoordinates(x + lateralX, z + lateralZ)
      footprints.push({
        s: coordinates.s,
        u: coordinates.u,
        heading,
        side: this.side
      })
      this.side *= -1
      this.stepDistance -= this.nextStepLength
      this.nextStepLength = this.side > 0 ? 0.58 : 0.72
    }
  }
}
