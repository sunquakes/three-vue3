import * as THREE from 'three'

export interface GlowSpriteOptions {
  /** Color of the halo gradient, default: 0x8ecbff */
  color?: number
  /** Tint multiplied over the halo, default: 0xbcdfff */
  tint?: number
  /** Screen-space diameter in world units, default: 3.2 */
  size?: number
  /** Opacity of the halo, default: 0.9 */
  opacity?: number
  /** Canvas resolution of the generated halo texture, default: 128 */
  resolution?: number
  /**
   * Seconds per breathing cycle. When set, the halo gently pulses on its own —
   * scale swings about 12% and opacity between 75% and 100% of the configured
   * values — and no per-frame code is needed.
   */
  pulsePeriod?: number
  /** Phase offset in the 0-1 range used to stagger pulsing sprites, default: 0 */
  phase?: number
}

// Halo colors are painted into a canvas, not into a managed material color, so
// unpack the hex straight to 0-1 channels instead of going through color
// management.
function toRgb(hex: number): [number, number, number] {
  return [((hex >> 16) & 0xff) / 255, ((hex >> 8) & 0xff) / 255, (hex & 0xff) / 255]
}

function createGlowTexture(color: number, resolution: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = resolution
  canvas.height = resolution

  const ctx = canvas.getContext('2d')
  if (ctx) {
    const rgb = toRgb(color)
      .map((channel) => Math.round(channel * 255))
      .join(', ')
    const center = resolution / 2
    const gradient = ctx.createRadialGradient(center, center, 0, center, center, center)
    gradient.addColorStop(0, `rgba(${rgb}, 1)`)
    gradient.addColorStop(0.22, `rgba(${rgb}, 0.55)`)
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, resolution, resolution)
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function wrap01(value: number): number {
  return ((value % 1) + 1) % 1
}

/**
 * Camera-facing halo sprite drawn from a generated radial-gradient texture: the
 * pale dot of a distant planet, a beacon, or a soft light bloom. It ignores fog
 * and depth writes and blends additively, so it only ever brightens what is
 * behind it.
 *
 * Pass `pulsePeriod` to let the halo breathe on its own — a beacon needs no
 * animation loop: `new GlowSprite({ pulsePeriod: 2.2 })`.
 */
export default class GlowSprite extends THREE.Sprite {
  private readonly baseSize: number
  private readonly baseOpacity: number
  private readonly pulsePeriod?: number
  private readonly phase: number
  /**
   * Own monotonic clock. TSL's `time` uniform is only refreshed while a node
   * shader samples it, and a sprite uses a plain SpriteMaterial, so the sprite
   * keeps its clock instead.
   */
  private readonly startedAt = performance.now()
  private disposed = false

  constructor(options: GlowSpriteOptions = {}) {
    const {
      color = 0x8ecbff,
      tint = 0xbcdfff,
      size = 3.2,
      opacity = 0.9,
      resolution = 128,
      pulsePeriod,
      phase = 0
    } = options

    super(
      new THREE.SpriteMaterial({
        map: createGlowTexture(color, resolution),
        color: tint,
        transparent: true,
        opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false
      })
    )

    this.baseSize = size
    this.baseOpacity = opacity
    this.pulsePeriod = pulsePeriod !== undefined && pulsePeriod > 0 ? pulsePeriod : undefined
    this.phase = phase
    this.scale.setScalar(size)

    if (this.pulsePeriod !== undefined) {
      this.onBeforeRender = () => this.tick()
    }
  }

  public dispose(): void {
    if (this.disposed) return
    this.disposed = true

    this.parent?.remove(this)
    this.material.map?.dispose()
    this.material.map = null
    this.material.dispose()
  }

  private tick(): void {
    if (this.disposed || this.pulsePeriod === undefined) return

    // Smooth breathing curve: one full cycle swings scale and opacity gently
    // around the configured values.
    const life = wrap01((performance.now() - this.startedAt) / 1000 / this.pulsePeriod + this.phase)
    const breath = 0.5 - 0.5 * Math.cos(life * Math.PI * 2)
    this.scale.setScalar(this.baseSize * (1 + (breath * 2 - 1) * 0.12))
    this.material.opacity = this.baseOpacity * (0.75 + breath * 0.25)

    // The renderer computed matrixWorld before this hook ran; refresh it so
    // the shader picks up the same-frame size change.
    this.updateMatrixWorld()
  }
}
