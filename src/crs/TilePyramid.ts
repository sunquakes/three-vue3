import type { TileIndex } from './Tiles'

/**
 * Axis-aligned rectangle on the local ground plane, in metres.
 */
export interface GroundRect {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

/**
 * Lifecycle of one tile node in the selection pyramid.
 */
export enum TileState {
  Idle,
  Loading,
  Loaded,
  Failed
}

/**
 * Mutable per-tile selection state. Concrete layers extend this interface with
 * their own resources (mesh, texture, cached bounds); the pyramid only reads
 * and writes the fields declared here.
 */
export interface TileNodeBase {
  index: TileIndex
  state: TileState
  attempts: number
  /** Stamp of the last selection traversal that included this node. */
  lastSeen: number
  queued: boolean
  rendering: boolean
}

export interface SelectIdealOptions {
  /** Ground rectangle that must stay covered. */
  rect: GroundRect
  /** Local ground bounds of a tile index; typically cached on the node. */
  boundsOf: (index: TileIndex) => GroundRect
  /** Extra coverage margin in metres around the rectangle. */
  margin?: number
  /** Deepest zoom level the pyramid refines to. */
  maxZoom: number
  /**
   * Per-tile refinement test (e.g. screen-space error). A tile keeps
   * subdividing while this returns true.
   */
  shouldRefine?: (index: TileIndex) => boolean
  /** Early stop after this many ideal nodes. */
  maxIdealNodes?: number
}

export const tileKey = (index: TileIndex): string => `${index.z}_${index.x}_${index.y}`

/** Address of one of a tile's four children (quadrant 0..3). */
export function childIndex(index: TileIndex, quadrant: number): TileIndex {
  return {
    z: index.z + 1,
    x: index.x * 2 + (quadrant % 2),
    y: index.y * 2 + (quadrant >> 1)
  }
}

/**
 * The standard XYZ scheme has exactly one zoom-0 tile covering the whole
 * world; it roots every traversal. A second root would be an out-of-range
 * world copy: tile bounds wrap its x back onto the same ground as the real
 * tiles, so both trees would render overlapping quads at every zoom while
 * their URLs (built from the raw out-of-range x) fetch blank placeholder
 * imagery - the map gets painted over with empty tiles.
 */
export const ROOT_TILES: TileIndex[] = [{ z: 0, x: 0, y: 0 }]

function overlaps(bounds: GroundRect, rect: GroundRect, margin: number): boolean {
  return (
    bounds.maxX + margin >= rect.minX &&
    bounds.minX - margin <= rect.maxX &&
    bounds.maxZ + margin >= rect.minZ &&
    bounds.minZ - margin <= rect.maxZ
  )
}

/**
 * Quadtree tile selection with ancestor-cover refinement, the model used by
 * Cesium/3D Tiles style engines.
 *
 * One traversal (`selectIdeal`) marks the ideal set: every tile whose ground
 * footprint touches the coverage rectangle, refined while the refinement test
 * holds. `renderSet` then picks what is actually displayed: an ideal tile is
 * only replaced by its children once every child the ideal region needs is
 * loaded (atomic refinement), and while an ideal tile is still downloading the
 * nearest loaded ancestor - or any loaded descendant that arrived early -
 * paints its footprint instead. The visible surface therefore never has holes
 * once the roots have loaded, and never overlaps two levels of detail.
 */
export class TilePyramid<N extends TileNodeBase = TileNodeBase> {
  readonly nodes = new Map<string, N>()
  private stamp = 0
  private readonly maxLoadAttempts: number
  private readonly createNode: (index: TileIndex) => N

  constructor(options: { createNode?: (index: TileIndex) => N; maxLoadAttempts?: number } = {}) {
    this.maxLoadAttempts = options.maxLoadAttempts ?? 2
    this.createNode =
      options.createNode ??
      ((index: TileIndex) => {
        return {
          index,
          state: TileState.Idle,
          attempts: 0,
          lastSeen: 0,
          queued: false,
          rendering: false
        } as N
      })
    ROOT_TILES.forEach((root) => this.getOrCreate(root))
  }

  getOrCreate(index: TileIndex): N {
    const key = tileKey(index)
    const existing = this.nodes.get(key)
    if (existing) return existing
    const node = this.createNode(index)
    this.nodes.set(key, node)
    return node
  }

  /**
   * Mark the ideal set for one traversal and return its size. Tiles touching
   * the rectangle (plus margin) are marked on `lastSeen`; subdivision stops at
   * `maxZoom`, when `shouldRefine` fails, or past `maxIdealNodes`.
   */
  selectIdeal(options: SelectIdealOptions): number {
    this.stamp += 1
    const margin = options.margin ?? 0
    const maxIdealNodes = options.maxIdealNodes ?? Number.POSITIVE_INFINITY
    let count = 0
    const visit = (index: TileIndex): void => {
      const node = this.getOrCreate(index)
      const bounds = options.boundsOf(index)
      if (!overlaps(bounds, options.rect, margin)) return
      node.lastSeen = this.stamp
      count += 1
      if (count > maxIdealNodes) return
      if (index.z >= options.maxZoom) return
      if (options.shouldRefine && !options.shouldRefine(index)) return
      for (let quadrant = 0; quadrant < 4; quadrant += 1) {
        visit(childIndex(index, quadrant))
      }
    }
    ROOT_TILES.forEach(visit)
    return count
  }

  /**
   * Decide the visible tile set for the current ideal set and refresh every
   * node's `rendering` flag. Returns the keys of rendered nodes.
   */
  renderSet(): Set<string> {
    const visible = new Set<string>()
    const visit = (index: TileIndex, ideal: boolean): void => {
      const node = this.nodes.get(tileKey(index))
      if (!node) return
      const idealChildren: TileIndex[] = []
      for (let quadrant = 0; quadrant < 4; quadrant += 1) {
        const child = childIndex(index, quadrant)
        if (this.nodes.get(tileKey(child))?.lastSeen === this.stamp) {
          idealChildren.push(child)
        }
      }

      if (node.state === TileState.Loaded) {
        // Atomic refinement: swap to the children only when every child the
        // ideal region needs is loaded. A loaded tile reached on a fallback
        // path (its ideal ancestor is still downloading, e.g. an image that
        // arrived out of order) paints its own footprint so the region never
        // goes dark while the coarser parent is in flight.
        if (
          ideal &&
          idealChildren.length > 0 &&
          idealChildren.every((child) => this.nodes.get(tileKey(child))?.state === TileState.Loaded)
        ) {
          idealChildren.forEach((child) => visit(child, true))
          return
        }
        visible.add(tileKey(index))
        return
      }

      // Not loaded yet: descend looking for any loaded descendant to show.
      idealChildren.forEach((child) => visit(child, false))
    }

    ROOT_TILES.forEach((root) => visit(root, true))

    this.nodes.forEach((node) => {
      node.rendering = visible.has(tileKey(node.index))
    })
    return visible
  }

  /**
   * Ideal nodes that still need a download, coarse zoom first so the layer
   * streams from the root covers down to full detail. Failed nodes reappear
   * until their retry budget is exhausted.
   */
  pendingIdeal(): N[] {
    const pending: N[] = []
    this.nodes.forEach((node) => {
      if (node.lastSeen !== this.stamp) return
      if (node.state === TileState.Idle) {
        pending.push(node)
        return
      }
      if (node.state === TileState.Failed && node.attempts < this.maxLoadAttempts) {
        pending.push(node)
      }
    })
    pending.sort((a, b) => a.index.z - b.index.z)
    return pending
  }

  /**
   * Evict cache-only nodes to bound memory, least-recently-seen first. Nodes
   * in the current ideal set, currently rendering, downloading or queued are
   * protected. Returns the evicted nodes so the caller can release their GPU
   * resources; they are already removed from the pyramid.
   */
  evictStale(maxTiles: number, cacheFactor = 2): N[] {
    const removable: N[] = []
    this.nodes.forEach((node) => {
      if (
        node.lastSeen === this.stamp ||
        node.rendering ||
        node.state === TileState.Loading ||
        node.queued
      ) {
        return
      }
      removable.push(node)
    })
    const overflow = this.nodes.size - maxTiles * cacheFactor
    if (overflow <= 0) return []
    removable.sort((a, b) => a.lastSeen - b.lastSeen)
    const evicted: N[] = []
    for (let i = 0; i < Math.min(overflow, removable.length); i += 1) {
      const node = removable[i]
      node.state = TileState.Idle
      node.rendering = false
      this.nodes.delete(tileKey(node.index))
      evicted.push(node)
    }
    return evicted
  }

  /** Drop every node; returns them so the caller can release resources. */
  clear(): N[] {
    const all = Array.from(this.nodes.values())
    this.nodes.clear()
    return all
  }
}
