export interface TextSampleOptions {
  /** Offscreen canvas width in pixels, default: 1400 */
  canvasWidth?: number
  /** Offscreen canvas height in pixels, default: 420 */
  canvasHeight?: number
  /** Font size used before the text is auto-fitted, default: 168 */
  baseFontSize?: number
  /** Smallest font size the auto-fit may shrink to, default: 56 */
  minFontSize?: number
  /** Maximum number of lines, default: 2 */
  maxLines?: number
  /** CSS font family, default: a system sans-serif stack */
  fontFamily?: string
  /** CSS font weight, default: 700 */
  fontWeight?: string | number
  /** Line height multiplier, default: 1.14 */
  lineHeight?: number
  /** Fraction of the canvas width the text block may occupy, default: 0.92 */
  widthRatio?: number
  /** Pixel grid step used to sample glyph alpha, default: 3 */
  sampleStep?: number
  /** Minimum alpha (0-255) a pixel needs to spawn a particle, default: 110 */
  alphaThreshold?: number
  /** World units per canvas pixel, default: 0.0068 */
  worldScale?: number
  /** Vertical offset of the text centre in world units, default: 0.55 */
  offsetY?: number
}

export interface TextLayoutOptions {
  /** Widest line the layout may use, in canvas pixels */
  width: number
  /** Font size the layout starts from */
  baseFontSize: number
  /** Smallest font size the layout may shrink to */
  minFontSize: number
  /** Maximum number of lines */
  maxLines: number
}

export interface TextLayout {
  lines: string[]
  fontSize: number
}

export interface TextSample {
  /** Number of sampled glyph points */
  count: number
  /** Interleaved xyz particle positions in world space */
  positions: Float32Array
  /** Canvas width used for sampling, needed to group particles by their x */
  canvasWidth: number
  /** Canvas height used for sampling */
  canvasHeight: number
  /** World units per canvas pixel used for sampling */
  worldScale: number
  /** Number of lines the text was laid out on */
  lines: number
  /** Font size chosen while fitting the text */
  fontSize: number
}

export type TextMeasure = (text: string, fontSize: number) => number

const SAMPLE_DEFAULTS = {
  canvasWidth: 1400,
  canvasHeight: 420,
  baseFontSize: 168,
  minFontSize: 56,
  maxLines: 2,
  fontFamily: '"Segoe UI", "Microsoft YaHei", "PingFang SC", Arial, sans-serif',
  fontWeight: 700,
  lineHeight: 1.14,
  widthRatio: 0.92,
  sampleStep: 3,
  alphaThreshold: 110,
  worldScale: 0.0068,
  offsetY: 0.55
} as const

const CJK_PATTERN = /[\u3400-\u9fff]/

// Split the text into wrap tokens: whole words for space separated text, single
// characters for CJK (or any text without spaces), so long Chinese sentences
// break between characters instead of overflowing the canvas.
function splitTokens(text: string): { tokens: string[]; separator: string } {
  const trimmed = text.trim()

  if (trimmed.length === 0) return { tokens: [], separator: '' }
  if (/\s/.test(trimmed)) return { tokens: trimmed.split(/\s+/), separator: ' ' }
  if (CJK_PATTERN.test(trimmed)) return { tokens: Array.from(trimmed), separator: '' }

  return { tokens: [trimmed], separator: '' }
}

function wrapTokens(
  tokens: string[],
  separator: string,
  maxWidth: number,
  measure: (text: string) => number
): string[] {
  if (tokens.length === 0) return []

  const lines: string[] = []
  let line = ''

  for (const token of tokens) {
    const candidate = line ? line + separator + token : token
    if (line && measure(candidate) > maxWidth) {
      lines.push(line)
      line = token
    } else {
      line = candidate
    }
  }

  if (line) lines.push(line)
  return lines
}

/**
 * Lay out text on a canvas of the given width, shrinking the font until the
 * text fits in `maxLines` lines. Pure: measurement is delegated to `measure`
 * so the layout can be tested without a real canvas.
 */
export function layoutText(text: string, options: TextLayoutOptions, measure: TextMeasure): TextLayout {
  const { width, baseFontSize, minFontSize, maxLines } = options
  const { tokens, separator } = splitTokens(text)

  if (tokens.length === 0) return { lines: [], fontSize: baseFontSize }

  const lineLimit = Math.max(1, Math.floor(maxLines))
  let fallback: TextLayout = { lines: [], fontSize: minFontSize }

  for (let fontSize = Math.floor(baseFontSize); fontSize >= minFontSize; fontSize -= 4) {
    const lines = wrapTokens(tokens, separator, width, (value) => measure(value, fontSize))
    fallback = { lines, fontSize }
    if (lines.length <= lineLimit) return fallback
  }

  return { lines: fallback.lines.slice(0, lineLimit), fontSize: fallback.fontSize }
}

/**
 * Draw `text` onto an offscreen canvas and sample every lit pixel on a fixed
 * grid, producing one particle position per sample. Each position is converted
 * to world units with `worldScale` and `offsetY`, and keeps z = 0 so the effect
 * stays on a single plane.
 */
export function sampleTextParticles(text: string, options: TextSampleOptions = {}): TextSample {
  const {
    canvasWidth,
    canvasHeight,
    baseFontSize,
    minFontSize,
    maxLines,
    fontFamily,
    fontWeight,
    lineHeight,
    widthRatio,
    sampleStep,
    alphaThreshold,
    worldScale,
    offsetY
  } = { ...SAMPLE_DEFAULTS, ...options }

  if (typeof document === 'undefined') {
    throw new Error('Text sampling requires a DOM document')
  }

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.floor(canvasWidth))
  canvas.height = Math.max(1, Math.floor(canvasHeight))

  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) {
    throw new Error('Text sampling requires a 2D canvas context')
  }

  const fontFor = (size: number): string => `${fontWeight} ${size}px ${fontFamily}`
  const measure: TextMeasure = (value, size) => {
    ctx.font = fontFor(size)
    return ctx.measureText(value).width
  }

  const { lines, fontSize } = layoutText(
    text,
    {
      width: canvas.width * widthRatio,
      baseFontSize,
      minFontSize,
      maxLines
    },
    measure
  )

  if (lines.length > 0) {
    const lineHeightPx = fontSize * lineHeight
    const firstLineY = canvas.height / 2 - ((lines.length - 1) * lineHeightPx) / 2

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#fff'
    ctx.font = fontFor(fontSize)

    lines.forEach((line, index) => {
      ctx.fillText(line, canvas.width / 2, firstLineY + index * lineHeightPx)
    })
  }

  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data
  const step = Math.max(1, Math.floor(sampleStep))
  const halfStep = Math.floor(step / 2)
  const positions: number[] = []

  for (let y = halfStep; y < canvas.height; y += step) {
    for (let x = halfStep; x < canvas.width; x += step) {
      const alpha = pixels[(y * canvas.width + x) * 4 + 3]
      if (alpha < alphaThreshold) continue

      positions.push(
        (x - canvas.width / 2) * worldScale,
        (canvas.height / 2 - y) * worldScale + offsetY,
        0
      )
    }
  }

  return {
    count: positions.length / 3,
    positions: Float32Array.from(positions),
    canvasWidth: canvas.width,
    canvasHeight: canvas.height,
    worldScale,
    lines: lines.length,
    fontSize
  }
}
