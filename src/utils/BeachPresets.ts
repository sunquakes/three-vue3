import * as THREE from 'three'

/** Time-of-day presets for the sandy beach scene. */
export type BeachPresetName = 'sunrise' | 'morning' | 'sunset' | 'night' | 'blueHour'

export interface BeachPresetDefinition {
  name: BeachPresetName
  label: { en: string; zh: string }
  /** Sun elevation above the horizon, in degrees. */
  elevation: number
  /** Sun azimuth, in degrees, measured from +Z towards +X. */
  azimuth: number
  sunColor: THREE.Color
  zenith: THREE.Color
  horizon: THREE.Color
  horizonSun: THREE.Color
  mid: THREE.Color
  glow: THREE.Color
  cloudSun: THREE.Color
  cloudShade: THREE.Color
  sand: THREE.Color
  waterDeep: THREE.Color
  waterShallow: THREE.Color
  /** Brightness of the sun/moon disc. */
  sunDisk: number
  /** Angular diameter of the sun/moon disc, in degrees. */
  discSize: number
  /** 0 for daylight, 1 for full night (enables stars and dims clouds). */
  night: number
  /** Directional light intensity. */
  sunLight: number
  /** Exposure applied before the ACES tone-mapping curve. */
  exposure: number
}

const color = (hex: string) => new THREE.Color(hex)

export const BEACH_PRESET_NAMES: BeachPresetName[] = [
  'sunrise',
  'morning',
  'sunset',
  'night',
  'blueHour'
]

export const BEACH_PRESETS: Record<BeachPresetName, BeachPresetDefinition> = {
  sunrise: {
    name: 'sunrise',
    label: { en: 'Sunrise', zh: '日出' },
    elevation: 6,
    azimuth: -20,
    sunColor: color('#ffca8a'),
    zenith: color('#2a72c4'),
    horizon: color('#b8d5e8'),
    horizonSun: color('#ffb877'),
    mid: color('#6aa6d8'),
    glow: color('#ffcf94'),
    cloudSun: color('#ffe3bd'),
    cloudShade: color('#9aa8c0'),
    sand: color('#e6d4b6'),
    waterDeep: color('#17578c'),
    waterShallow: color('#4fd2c8'),
    sunDisk: 3,
    discSize: 1.6,
    night: 0,
    sunLight: 1.35,
    exposure: 1.02
  },
  morning: {
    name: 'morning',
    label: { en: 'Morning', zh: '清晨' },
    elevation: 28,
    azimuth: -40,
    sunColor: color('#fff1d6'),
    zenith: color('#2b7fd2'),
    horizon: color('#c6e0f2'),
    horizonSun: color('#7fb6e8'),
    mid: color('#6fb2e4'),
    glow: color('#ffe8c8'),
    cloudSun: color('#ffffff'),
    cloudShade: color('#a8b8d0'),
    sand: color('#e8d9bd'),
    waterDeep: color('#12588a'),
    waterShallow: color('#52d4c9'),
    sunDisk: 2,
    discSize: 1,
    night: 0,
    sunLight: 1.7,
    exposure: 0.98
  },
  sunset: {
    name: 'sunset',
    label: { en: 'Sunset', zh: '日落' },
    elevation: 1.5,
    azimuth: 160,
    sunColor: color('#ffb066'),
    zenith: color('#3e4880'),
    horizon: color('#966494'),
    horizonSun: color('#fea85c'),
    mid: color('#e87660'),
    glow: color('#ff9e55'),
    cloudSun: color('#ffc890'),
    cloudShade: color('#6a5f88'),
    sand: color('#c9a184'),
    waterDeep: color('#132033'),
    waterShallow: color('#555d6a'),
    sunDisk: 2.6,
    discSize: 1.5,
    night: 0,
    sunLight: 1.25,
    exposure: 1.08
  },
  night: {
    name: 'night',
    label: { en: 'Night', zh: '夜晚' },
    elevation: 24,
    azimuth: -25,
    sunColor: color('#afc2e8'),
    zenith: color('#010828'),
    horizon: color('#082a66'),
    horizonSun: color('#103876'),
    mid: color('#061e56'),
    glow: color('#2e4766'),
    cloudSun: color('#6b7d9e'),
    cloudShade: color('#1c2740'),
    sand: color('#5b6374'),
    waterDeep: color('#030d1a'),
    waterShallow: color('#17324a'),
    sunDisk: 1.4,
    discSize: 2.2,
    night: 1,
    sunLight: 0.16,
    exposure: 1.6
  },
  blueHour: {
    name: 'blueHour',
    label: { en: 'Blue hour', zh: '蓝调时刻' },
    elevation: 0.5,
    azimuth: -20,
    sunColor: color('#c98a78'),
    zenith: color('#1a2a64'),
    horizon: color('#6264a2'),
    horizonSun: color('#ea8050'),
    mid: color('#7c6aa8'),
    glow: color('#6b4c6e'),
    cloudSun: color('#d59a92'),
    cloudShade: color('#454068'),
    sand: color('#8a8598'),
    waterDeep: color('#0b1930'),
    waterShallow: color('#2d4a63'),
    sunDisk: 0.5,
    discSize: 0.9,
    night: 0.45,
    sunLight: 0.38,
    exposure: 1.28
  }
}

/** Mutable snapshot of a preset used while blending between presets. */
export interface BeachPresetState {
  sunDirection: THREE.Vector3
  sunColor: THREE.Color
  zenith: THREE.Color
  horizon: THREE.Color
  horizonSun: THREE.Color
  mid: THREE.Color
  glow: THREE.Color
  cloudSun: THREE.Color
  cloudShade: THREE.Color
  sand: THREE.Color
  waterDeep: THREE.Color
  waterShallow: THREE.Color
  sunDisk: number
  discSize: number
  night: number
  sunLight: number
  exposure: number
}

/** Direction pointing towards the sun for a preset. */
export function beachSunDirection(preset: BeachPresetDefinition): THREE.Vector3 {
  const elevation = THREE.MathUtils.degToRad(preset.elevation)
  const azimuth = THREE.MathUtils.degToRad(preset.azimuth)
  return new THREE.Vector3(
    Math.sin(azimuth) * Math.cos(elevation),
    Math.sin(elevation),
    Math.cos(azimuth) * Math.cos(elevation)
  ).normalize()
}

export function createBeachPresetState(name: BeachPresetName): BeachPresetState {
  const preset = BEACH_PRESETS[name]
  return {
    sunDirection: beachSunDirection(preset),
    sunColor: preset.sunColor.clone(),
    zenith: preset.zenith.clone(),
    horizon: preset.horizon.clone(),
    horizonSun: preset.horizonSun.clone(),
    mid: preset.mid.clone(),
    glow: preset.glow.clone(),
    cloudSun: preset.cloudSun.clone(),
    cloudShade: preset.cloudShade.clone(),
    sand: preset.sand.clone(),
    waterDeep: preset.waterDeep.clone(),
    waterShallow: preset.waterShallow.clone(),
    sunDisk: preset.sunDisk,
    discSize: preset.discSize,
    night: preset.night,
    sunLight: preset.sunLight,
    exposure: preset.exposure
  }
}

const lerp = THREE.MathUtils.lerp

/** Blends `current` towards `target` in place. */
export function lerpBeachPresetState(
  current: BeachPresetState,
  target: BeachPresetState,
  alpha: number
): void {
  const t = THREE.MathUtils.clamp(alpha, 0, 1)
  current.sunDirection.lerp(target.sunDirection, t).normalize()
  current.sunColor.lerp(target.sunColor, t)
  current.zenith.lerp(target.zenith, t)
  current.horizon.lerp(target.horizon, t)
  current.horizonSun.lerp(target.horizonSun, t)
  current.mid.lerp(target.mid, t)
  current.glow.lerp(target.glow, t)
  current.cloudSun.lerp(target.cloudSun, t)
  current.cloudShade.lerp(target.cloudShade, t)
  current.sand.lerp(target.sand, t)
  current.waterDeep.lerp(target.waterDeep, t)
  current.waterShallow.lerp(target.waterShallow, t)
  current.sunDisk = lerp(current.sunDisk, target.sunDisk, t)
  current.discSize = lerp(current.discSize, target.discSize, t)
  current.night = lerp(current.night, target.night, t)
  current.sunLight = lerp(current.sunLight, target.sunLight, t)
  current.exposure = lerp(current.exposure, target.exposure, t)
}
