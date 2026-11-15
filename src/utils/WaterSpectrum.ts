import * as THREE from 'three'

export interface OceanWave {
  direction: THREE.Vector2
  steepness: number
  wavelength: number
  speed: number
  phase: number
  bendFrequency: number
  bendStrength: number
  packetFrequency: number
  packetStrength: number
  crestSharpness: number
  lodStart: number
  lodEnd: number
}

export interface OceanDomainWarp {
  waveVector: THREE.Vector2
  displacement: THREE.Vector2
  speed: number
  phase: number
}

export interface OceanDomainVariant {
  phaseBias: number
  rotation: number
}

export interface OceanEnergyWave {
  waveVector: THREE.Vector2
  amplitude: number
  speed: number
  phase: number
}

export interface OceanSurfaceSample {
  height: number
  normal: THREE.Vector3
}

interface OceanDomainSample {
  warpedX: number
  warpedZ: number
  derivativeXX: number
  derivativeXZ: number
  derivativeZX: number
  derivativeZZ: number
  energy: number
  energyGradientX: number
  energyGradientZ: number
}

const createWave = (
  direction: [number, number],
  steepness: number,
  wavelength: number,
  speed: number,
  phase: number,
  bendFrequency: number,
  bendStrength: number,
  packetFrequency: number,
  packetStrength: number,
  crestSharpness: number,
  lodStart: number,
  lodEnd: number
): OceanWave => ({
  direction: new THREE.Vector2(direction[0], direction[1]).normalize(),
  steepness,
  wavelength,
  speed,
  phase,
  bendFrequency,
  bendStrength,
  packetFrequency,
  packetStrength,
  crestSharpness,
  lodStart,
  lodEnd
})

const createDomainWarp = (
  waveVector: [number, number],
  displacement: [number, number],
  speed: number,
  phase: number
): OceanDomainWarp => ({
  waveVector: new THREE.Vector2(waveVector[0], waveVector[1]),
  displacement: new THREE.Vector2(displacement[0], displacement[1]),
  speed,
  phase
})

const createEnergyWave = (
  waveVector: [number, number],
  amplitude: number,
  speed: number,
  phase: number
): OceanEnergyWave => ({
  waveVector: new THREE.Vector2(waveVector[0], waveVector[1]),
  amplitude,
  speed,
  phase
})

// Very long, non-commensurate modes bend the coordinate field rather than
// adding another visible sinusoid. They curve and split swell systems over
// hundreds of metres without changing the local crest scale.
export const OCEAN_DOMAIN_WARP: OceanDomainWarp[] = [
  createDomainWarp([0.0147, 0.0091], [5.2, -2.1], 0.011, 0.7),
  createDomainWarp([-0.0109, 0.0183], [-2.8, 4.6], -0.008, 3.1),
  createDomainWarp([0.0287, -0.0211], [1.9, 2.2], 0.006, 5.4)
]

export const OCEAN_DOMAIN_VARIANTS: OceanDomainVariant[] = [{ phaseBias: 0.0, rotation: 0.0 }]

// Broad wind-energy zones make some crest systems strengthen while others
// terminate. The frequencies deliberately share no common tile period.
export const OCEAN_ENERGY_WAVES: OceanEnergyWave[] = [
  createEnergyWave([0.0213, -0.0141], 0.22, 0.01, 0.8),
  createEnergyWave([-0.0137, 0.0269], 0.15, -0.008, 2.7),
  createEnergyWave([0.0391, 0.0187], 0.1, 0.006, 5.2)
]

// A broad, directional spectrum avoids the perfectly parallel Gerstner rows
// that become obvious from high camera positions. Slow cross-wave bending and
// wave packets make crests curve, merge, and dissipate over the 420 m patch.
// The same data is injected into the GPU shader and sampled here on the CPU.
export const OCEAN_WAVES: OceanWave[] = [
  // Split the swell energy across an irregular directional band. One strong
  // 24 m component made the whole 420 m patch correlate with itself every
  // wavelength when viewed from above.
  createWave([1.0, 0.14], 0.044, 25.7, 1.95, 0.3, 0.029, 2.7, 0.018, 0.52, 0.18, 250, 440),
  createWave([0.91, -0.42], 0.038, 31.3, 2.08, 4.17, 0.023, 3.1, 0.014, 0.48, 0.16, 260, 450),
  createWave([0.72, 0.69], 0.04, 28.1, 2.01, 1.83, 0.027, 2.45, 0.017, 0.46, 0.15, 240, 430),
  createWave([0.97, 0.25], 0.04, 22.9, 1.83, 5.22, 0.035, 2.05, 0.022, 0.44, 0.17, 210, 400),
  createWave([0.8, -0.6], 0.045, 20.7, 1.75, 2.78, 0.039, 1.85, 0.025, 0.42, 0.16, 190, 380),
  createWave([0.42, 0.91], 0.035, 18.9, 1.68, 5.4, 0.043, 1.55, 0.029, 0.38, 0.12, 170, 350),
  createWave([0.83, 0.56], 0.052, 16.0, 1.56, 2.1, 0.052, 1.45, 0.034, 0.4, 0.18, 170, 340),
  createWave([0.98, -0.18], 0.038, 13.4, 1.43, 3.2, 0.062, 0.8, 0.044, 0.34, 0.1, 120, 260),
  createWave([0.91, -0.42], 0.07, 11.8, 1.34, 4.75, 0.071, 0.92, 0.049, 0.36, 0.16, 120, 270),
  createWave([0.51, -0.86], 0.036, 9.3, 1.2, 0.7, 0.09, 0.55, 0.064, 0.3, 0.08, 75, 190),
  createWave([0.58, 0.82], 0.068, 8.7, 1.16, 1.25, 0.096, 0.62, 0.068, 0.32, 0.15, 70, 190),
  createWave([0.69, -0.72], 0.055, 6.4, 0.98, 3.6, 0.132, 0.42, 0.091, 0.3, 0.11, 48, 150),
  createWave([0.97, 0.25], 0.043, 4.8, 0.83, 5.55, 0.176, 0.29, 0.122, 0.26, 0.08, 34, 116),
  createWave([0.43, -0.9], 0.03, 3.5, 0.69, 0.82, 0.238, 0.2, 0.164, 0.22, 0.05, 25, 86)
]

function sampleOceanDomain(
  x: number,
  z: number,
  time: number,
  variant: OceanDomainVariant
): OceanDomainSample {
  let warpedX = x
  let warpedZ = z
  let derivativeXX = 1
  let derivativeXZ = 0
  let derivativeZX = 0
  let derivativeZZ = 1

  const cosineTurn = Math.cos(variant.rotation)
  const sineTurn = Math.sin(variant.rotation)

  for (const [modeIndex, mode] of OCEAN_DOMAIN_WARP.entries()) {
    const displacementX = cosineTurn * mode.displacement.x - sineTurn * mode.displacement.y
    const displacementZ = sineTurn * mode.displacement.x + cosineTurn * mode.displacement.y
    const phase =
      mode.waveVector.x * x +
      mode.waveVector.y * z -
      time * mode.speed +
      mode.phase +
      variant.phaseBias * (0.73 + modeIndex * 0.58)
    const sine = Math.sin(phase)
    const cosine = Math.cos(phase)
    warpedX += displacementX * sine
    warpedZ += displacementZ * sine
    derivativeXX += displacementX * cosine * mode.waveVector.x
    derivativeXZ += displacementX * cosine * mode.waveVector.y
    derivativeZX += displacementZ * cosine * mode.waveVector.x
    derivativeZZ += displacementZ * cosine * mode.waveVector.y
  }

  let energy = 0.82
  let energyGradientX = 0
  let energyGradientZ = 0
  for (const [modeIndex, mode] of OCEAN_ENERGY_WAVES.entries()) {
    const phase =
      mode.waveVector.x * x +
      mode.waveVector.y * z -
      time * mode.speed +
      mode.phase +
      variant.phaseBias * (1.11 + modeIndex * 0.47)
    const cosine = Math.cos(phase)
    energy += mode.amplitude * Math.sin(phase)
    energyGradientX += mode.amplitude * cosine * mode.waveVector.x
    energyGradientZ += mode.amplitude * cosine * mode.waveVector.y
  }

  return {
    warpedX,
    warpedZ,
    derivativeXX,
    derivativeXZ,
    derivativeZX,
    derivativeZZ,
    energy,
    energyGradientX,
    energyGradientZ
  }
}

export function sampleOceanSurface(x: number, z: number, time: number): OceanSurfaceSample {
  let height = 0
  let gradientX = 0
  let gradientZ = 0
  const domains = OCEAN_DOMAIN_VARIANTS.map((variant) => sampleOceanDomain(x, z, time, variant))

  for (const [waveIndex, waveDefinition] of OCEAN_WAVES.entries()) {
    const domain = domains[waveIndex % domains.length]
    const { direction } = waveDefinition
    const perpendicularX = -direction.y
    const perpendicularZ = direction.x
    const along = direction.x * domain.warpedX + direction.y * domain.warpedZ
    const across = perpendicularX * domain.warpedX + perpendicularZ * domain.warpedZ
    const alongGradientX = direction.x * domain.derivativeXX + direction.y * domain.derivativeZX
    const alongGradientZ = direction.x * domain.derivativeXZ + direction.y * domain.derivativeZZ
    const acrossGradientX =
      perpendicularX * domain.derivativeXX + perpendicularZ * domain.derivativeZX
    const acrossGradientZ =
      perpendicularX * domain.derivativeXZ + perpendicularZ * domain.derivativeZZ

    const bendPhase =
      across * waveDefinition.bendFrequency + waveDefinition.phase * 1.71 - time * 0.055
    const secondaryBendPhase =
      across * waveDefinition.bendFrequency * 2.13 - waveDefinition.phase * 0.73 + time * 0.035
    const bend =
      (Math.sin(bendPhase) + Math.sin(secondaryBendPhase) * 0.27) * waveDefinition.bendStrength

    const packetPhase =
      (along * 0.34 + across) * waveDefinition.packetFrequency + waveDefinition.phase * 2.07
    const secondaryPacketPhase =
      (along * -0.18 + across * 1.83) * waveDefinition.packetFrequency - waveDefinition.phase * 1.31
    const packetEnvelope =
      1 +
      waveDefinition.packetStrength *
        (Math.sin(packetPhase) * 0.68 + Math.sin(secondaryPacketPhase) * 0.32)
    const envelope = packetEnvelope * domain.energy

    const waveNumber = (Math.PI * 2) / waveDefinition.wavelength
    const amplitude = waveDefinition.steepness / waveNumber
    const currentPhase =
      waveNumber * (along + bend - waveDefinition.speed * time) + waveDefinition.phase
    const sine = Math.sin(currentPhase)
    const cosine = Math.cos(currentPhase)
    const shapedHeight = sine - waveDefinition.crestSharpness * Math.cos(currentPhase * 2)
    const shapedDerivative = cosine + waveDefinition.crestSharpness * 2 * Math.sin(currentPhase * 2)

    const bendDerivative =
      (Math.cos(bendPhase) * waveDefinition.bendFrequency +
        Math.cos(secondaryBendPhase) * waveDefinition.bendFrequency * 2.13 * 0.27) *
      waveDefinition.bendStrength
    const phaseGradientX = waveNumber * (alongGradientX + acrossGradientX * bendDerivative)
    const phaseGradientZ = waveNumber * (alongGradientZ + acrossGradientZ * bendDerivative)
    const packetGradientX =
      waveDefinition.packetStrength *
      (Math.cos(packetPhase) *
        0.68 *
        waveDefinition.packetFrequency *
        (alongGradientX * 0.34 + acrossGradientX) +
        Math.cos(secondaryPacketPhase) *
          0.32 *
          waveDefinition.packetFrequency *
          (alongGradientX * -0.18 + acrossGradientX * 1.83))
    const packetGradientZ =
      waveDefinition.packetStrength *
      (Math.cos(packetPhase) *
        0.68 *
        waveDefinition.packetFrequency *
        (alongGradientZ * 0.34 + acrossGradientZ) +
        Math.cos(secondaryPacketPhase) *
          0.32 *
          waveDefinition.packetFrequency *
          (alongGradientZ * -0.18 + acrossGradientZ * 1.83))
    const envelopeGradientX =
      packetGradientX * domain.energy + packetEnvelope * domain.energyGradientX
    const envelopeGradientZ =
      packetGradientZ * domain.energy + packetEnvelope * domain.energyGradientZ

    height += amplitude * envelope * shapedHeight
    gradientX +=
      amplitude * (envelopeGradientX * shapedHeight + envelope * shapedDerivative * phaseGradientX)
    gradientZ +=
      amplitude * (envelopeGradientZ * shapedHeight + envelope * shapedDerivative * phaseGradientZ)
  }

  return {
    height,
    normal: new THREE.Vector3(-gradientX, 1, -gradientZ).normalize()
  }
}
