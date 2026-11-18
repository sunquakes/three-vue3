import { describe, expect, it } from 'vitest'
import { TilePyramid, TileState, tileKey } from '../crs/TilePyramid'
import type { GroundRect, TileNodeBase } from '../crs/TilePyramid'
import type { TileIndex } from '../crs/Tiles'

/**
 * Deterministic local-space model for the tests. Like the Web Mercator world,
 * the ground is twice as wide as it is tall: 32 x 16 metres, covered by the
 * single zoom-0 root tile. Each level halves both spans. Real projection
 * maths is irrelevant here - only the quadtree behaviour of the selection is
 * under test.
 */
const WORLD_W = 32
const WORLD_H = 16
const WORLD_RECT: GroundRect = { minX: 0, maxX: WORLD_W, minZ: 0, maxZ: WORLD_H }

const boundsOf = (index: TileIndex): GroundRect => {
  const spanX = WORLD_W / 2 ** index.z
  const spanY = WORLD_H / 2 ** index.z
  return {
    minX: index.x * spanX,
    maxX: (index.x + 1) * spanX,
    minZ: index.y * spanY,
    maxZ: (index.y + 1) * spanY
  }
}

interface TestNode extends TileNodeBase {
  bounds: GroundRect | null
}

const createNode = (index: TileIndex): TestNode => ({
  index,
  state: TileState.Idle,
  attempts: 0,
  lastSeen: 0,
  queued: false,
  rendering: false,
  bounds: null
})

const createPyramid = (): TilePyramid<TestNode> =>
  new TilePyramid<TestNode>({ createNode, maxLoadAttempts: 2 })

/** Mark a node as if its image had finished downloading. */
const load = (pyramid: TilePyramid<TestNode>, index: TileIndex): void => {
  pyramid.getOrCreate(index).state = TileState.Loaded
}

/** Every rendered tile covering one sample point on the ground. */
const coveringAt = (pyramid: TilePyramid<TestNode>, x: number, z: number): TestNode[] => {
  const covers: TestNode[] = []
  pyramid.nodes.forEach((node) => {
    if (!node.rendering) return
    const bounds = boundsOf(node.index)
    if (x >= bounds.minX && x < bounds.maxX && z >= bounds.minZ && z < bounds.maxZ) {
      covers.push(node)
    }
  })
  return covers
}

/**
 * Invariant 1: every sample point of the rectangle is covered by at least one
 * rendered tile (no holes / black regions).
 */
const expectRectCovered = (pyramid: TilePyramid<TestNode>, rect: GroundRect): void => {
  const uncovered: string[] = []
  for (let x = rect.minX + 0.5; x < rect.maxX; x += 1) {
    for (let z = rect.minZ + 0.5; z < rect.maxZ; z += 1) {
      if (coveringAt(pyramid, x, z).length === 0) uncovered.push(`(${x},${z})`)
    }
  }
  expect(uncovered, `uncovered ground: ${uncovered.join(', ')}`).toEqual([])
}

/**
 * Invariant 2: no sample point of the world is covered by more than one zoom
 * level (no overlapping levels of detail at the same ground point).
 */
const expectNoLevelOverlap = (pyramid: TilePyramid<TestNode>): void => {
  const offenders: string[] = []
  for (let x = 0.5; x < WORLD_W; x += 1) {
    for (let z = 0.5; z < WORLD_H; z += 1) {
      const levels = new Set(coveringAt(pyramid, x, z).map((node) => node.index.z))
      if (levels.size > 1) offenders.push(`(${x},${z}): z=[${Array.from(levels).join(',')}]`)
    }
  }
  expect(offenders, `overlapping levels: ${offenders.join(', ')}`).toEqual([])
}

describe('TilePyramid', () => {
  it('creates the single zoom-0 root covering the world', () => {
    const pyramid = createPyramid()
    expect(pyramid.nodes.size).toBe(1)
    expect(boundsOf({ z: 0, x: 0, y: 0 })).toEqual(WORLD_RECT)
  })

  it('covers the rectangle with the root tile before anything else loads', () => {
    const pyramid = createPyramid()
    pyramid.selectIdeal({ rect: WORLD_RECT, boundsOf, maxZoom: 3 })
    load(pyramid, { z: 0, x: 0, y: 0 })
    pyramid.renderSet()
    expectRectCovered(pyramid, WORLD_RECT)
    expectNoLevelOverlap(pyramid)
  })

  it('refines atomically: a parent renders until all needed children load', () => {
    const pyramid = createPyramid()
    pyramid.selectIdeal({ rect: WORLD_RECT, boundsOf, maxZoom: 2 })
    // Root loaded, nothing else: the root must render.
    pyramid.pendingIdeal().forEach((node) => {
      if (node.index.z === 0) node.state = TileState.Loaded
    })
    pyramid.renderSet()
    expectRectCovered(pyramid, WORLD_RECT)
    expect(pyramid.getOrCreate({ z: 0, x: 0, y: 0 }).rendering).toBe(true)

    // Load every level-1 tile except one: the root must keep rendering.
    pyramid.pendingIdeal().forEach((node) => {
      if (node.index.z === 1 && tileKey(node.index) !== '1_1_1') {
        node.state = TileState.Loaded
      }
    })
    pyramid.renderSet()
    expectRectCovered(pyramid, WORLD_RECT)
    expect(pyramid.getOrCreate({ z: 0, x: 0, y: 0 }).rendering).toBe(true)

    // The last child arrives: the root hands over to all children at once.
    load(pyramid, { z: 1, x: 1, y: 1 })
    pyramid.renderSet()
    expectRectCovered(pyramid, WORLD_RECT)
    expectNoLevelOverlap(pyramid)
    expect(pyramid.getOrCreate({ z: 0, x: 0, y: 0 }).rendering).toBe(false)
    expect(pyramid.getOrCreate({ z: 1, x: 1, y: 1 }).rendering).toBe(true)
  })

  it('never leaves a hole when a tile fails permanently - the ancestor covers it', () => {
    const pyramid = createPyramid()
    pyramid.selectIdeal({ rect: WORLD_RECT, boundsOf, maxZoom: 3 })
    // Everything loads except one level-3 tile that exhausts its retries.
    pyramid.pendingIdeal().forEach((node) => {
      if (tileKey(node.index) === '3_5_2') {
        node.state = TileState.Failed
        node.attempts = 2
      } else {
        node.state = TileState.Loaded
      }
    })
    pyramid.renderSet()
    expectRectCovered(pyramid, WORLD_RECT)
    expectNoLevelOverlap(pyramid)
    expect(pyramid.getOrCreate({ z: 3, x: 5, y: 2 }).rendering).toBe(false)
    // Its level-2 parent paints the footprint instead.
    expect(pyramid.getOrCreate({ z: 2, x: 2, y: 1 }).rendering).toBe(true)
  })

  it('renders an early-arriving descendant while the root is still loading', () => {
    const pyramid = createPyramid()
    pyramid.selectIdeal({ rect: WORLD_RECT, boundsOf, maxZoom: 3 })
    // The root is still in flight; a deep tile lands out of order.
    pyramid.getOrCreate({ z: 0, x: 0, y: 0 }).state = TileState.Loading
    load(pyramid, { z: 2, x: 1, y: 1 })
    pyramid.renderSet()
    // The out-of-order tile paints its own footprint instead of going dark.
    expect(pyramid.getOrCreate({ z: 2, x: 1, y: 1 }).rendering).toBe(true)
    expect(coveringAt(pyramid, 12.5, 4.5).length).toBe(1)
  })

  it('keeps a panned-into region covered by cached ancestors', () => {
    const pyramid = createPyramid()
    const westHalf: GroundRect = { minX: 0, maxX: WORLD_W / 2, minZ: 0, maxZ: WORLD_H }
    pyramid.selectIdeal({ rect: westHalf, boundsOf, maxZoom: 3 })
    pyramid.pendingIdeal().forEach((node) => {
      node.state = TileState.Loaded
    })
    pyramid.renderSet()
    expectRectCovered(pyramid, westHalf)

    // Pan the window to the east half: new tiles are requested but only the
    // coarse levels have arrived, so they must cover the new ground.
    const eastHalf: GroundRect = { minX: WORLD_W / 2, maxX: WORLD_W, minZ: 0, maxZ: WORLD_H }
    pyramid.selectIdeal({ rect: eastHalf, boundsOf, maxZoom: 3 })
    pyramid.pendingIdeal().forEach((node) => {
      if (node.index.z >= 2) return
      node.state = TileState.Loaded
    })
    pyramid.renderSet()
    expectRectCovered(pyramid, eastHalf)
  })

  it('supports mixed detail levels without holes or overlaps (SSE-style refinement)', () => {
    const pyramid = createPyramid()
    // Refine only the west half of the world, like a near/far SSE gradient.
    const shouldRefine = (index: TileIndex): boolean => {
      const bounds = boundsOf(index)
      return bounds.minX < WORLD_W / 2
    }
    pyramid.selectIdeal({ rect: WORLD_RECT, boundsOf, maxZoom: 3, shouldRefine })
    pyramid.pendingIdeal().forEach((node) => {
      node.state = TileState.Loaded
    })
    pyramid.renderSet()
    expectRectCovered(pyramid, WORLD_RECT)
    expectNoLevelOverlap(pyramid)
    // The far (east) side stays coarse at level 1 while the near (west) side
    // is refined.
    expect(pyramid.getOrCreate({ z: 1, x: 1, y: 1 }).rendering).toBe(true)
    expect(pyramid.getOrCreate({ z: 3, x: 0, y: 0 }).rendering).toBe(true)
  })

  it('stops refining at maxZoom even when the refinement test always passes', () => {
    const pyramid = createPyramid()
    pyramid.selectIdeal({
      rect: WORLD_RECT,
      boundsOf,
      maxZoom: 2,
      shouldRefine: () => true
    })
    let deepest = 0
    pyramid.nodes.forEach((node) => {
      deepest = Math.max(deepest, node.index.z)
    })
    expect(deepest).toBe(2)
  })

  it('returns pending tiles coarse-first and retries failures within budget', () => {
    const pyramid = createPyramid()
    pyramid.selectIdeal({ rect: WORLD_RECT, boundsOf, maxZoom: 2 })
    const failed = pyramid.getOrCreate({ z: 1, x: 0, y: 0 })
    failed.state = TileState.Failed
    failed.attempts = 1
    const exhausted = pyramid.getOrCreate({ z: 1, x: 1, y: 0 })
    exhausted.state = TileState.Failed
    exhausted.attempts = 2

    const pending = pyramid.pendingIdeal()
    const pendingKeys = pending.map((node) => tileKey(node.index))
    // '1_0_0' retries (attempts < 2), '1_1_0' does not (budget exhausted).
    expect(pendingKeys).toContain('1_0_0')
    expect(pendingKeys).not.toContain('1_1_0')
    // Coarse zooms come first.
    const zooms = pending.map((node) => node.index.z)
    expect([...zooms].sort((a, b) => a - b)).toEqual(zooms)
  })

  it('evicts only stale cache nodes, never the visible or in-flight ones', () => {
    const pyramid = createPyramid()
    pyramid.selectIdeal({ rect: WORLD_RECT, boundsOf, maxZoom: 3 })
    pyramid.pendingIdeal().forEach((node) => {
      node.state = TileState.Loaded
    })
    pyramid.renderSet()

    // Shrink the window to the west half: old east-side mid-level tiles are
    // stale cache (they stopped rendering once their children took over), and
    // the reselection also created never-seen siblings outside the window.
    const westHalf: GroundRect = { minX: 0, maxX: WORLD_W / 2, minZ: 0, maxZ: WORLD_H }
    pyramid.selectIdeal({ rect: westHalf, boundsOf, maxZoom: 3 })
    const evicted = pyramid.evictStale(1, 2)
    expect(evicted.length).toBeGreaterThan(0)
    evicted.forEach((node) => {
      expect(pyramid.nodes.has(tileKey(node.index))).toBe(false)
      // The current ideal set is never evicted.
      expect(node.lastSeen).not.toBe(2)
    })
    // Whatever survives is either the current ideal set or still rendering.
    pyramid.nodes.forEach((node) => {
      expect(node.lastSeen === 2 || node.rendering).toBe(true)
    })

    // Under an extreme budget the visible set still survives: everything
    // left is protected by lastSeen or by still rendering.
    expect(pyramid.evictStale(0, 1).length).toBe(0)
  })

  it('clear returns every node for resource disposal', () => {
    const pyramid = createPyramid()
    pyramid.selectIdeal({ rect: WORLD_RECT, boundsOf, maxZoom: 1 })
    const all = pyramid.clear()
    expect(all.length).toBeGreaterThan(0)
    expect(pyramid.nodes.size).toBe(0)
  })
})
