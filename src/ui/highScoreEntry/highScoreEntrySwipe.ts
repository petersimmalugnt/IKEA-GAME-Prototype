import type { CursorSweepSegment } from '@/input/cursorVelocity'

const SEGMENT_EPSILON = 1e-6

export type SwipeThresholdConfig = {
  minVelocityPx: number
  minDistancePx: number
}

export type ScreenRect = {
  left: number
  top: number
  right: number
  bottom: number
}

function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value)
}

function pointInRect(x: number, y: number, rect: ScreenRect): boolean {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
}

function orientation(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): number {
  return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)
}

function onSegment(ax: number, ay: number, bx: number, by: number, px: number, py: number): boolean {
  return (
    px >= Math.min(ax, bx) - SEGMENT_EPSILON
    && px <= Math.max(ax, bx) + SEGMENT_EPSILON
    && py >= Math.min(ay, by) - SEGMENT_EPSILON
    && py <= Math.max(ay, by) + SEGMENT_EPSILON
  )
}

function segmentsIntersect(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
): boolean {
  const o1 = orientation(ax, ay, bx, by, cx, cy)
  const o2 = orientation(ax, ay, bx, by, dx, dy)
  const o3 = orientation(cx, cy, dx, dy, ax, ay)
  const o4 = orientation(cx, cy, dx, dy, bx, by)

  if ((o1 > 0 && o2 < 0 || o1 < 0 && o2 > 0) && (o3 > 0 && o4 < 0 || o3 < 0 && o4 > 0)) {
    return true
  }

  if (Math.abs(o1) <= SEGMENT_EPSILON && onSegment(ax, ay, bx, by, cx, cy)) return true
  if (Math.abs(o2) <= SEGMENT_EPSILON && onSegment(ax, ay, bx, by, dx, dy)) return true
  if (Math.abs(o3) <= SEGMENT_EPSILON && onSegment(cx, cy, dx, dy, ax, ay)) return true
  if (Math.abs(o4) <= SEGMENT_EPSILON && onSegment(cx, cy, dx, dy, bx, by)) return true

  return false
}

export function toScreenRect(rect: DOMRectReadOnly | DOMRect): ScreenRect {
  return {
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
  }
}

export function segmentIntersectsRect(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  rect: ScreenRect,
): boolean {
  if (!isFiniteNumber(x0) || !isFiniteNumber(y0) || !isFiniteNumber(x1) || !isFiniteNumber(y1)) return false

  const minX = x0 < x1 ? x0 : x1
  const maxX = x0 > x1 ? x0 : x1
  const minY = y0 < y1 ? y0 : y1
  const maxY = y0 > y1 ? y0 : y1

  if (maxX < rect.left || minX > rect.right || maxY < rect.top || minY > rect.bottom) {
    return false
  }

  if (pointInRect(x0, y0, rect) || pointInRect(x1, y1, rect)) {
    return true
  }

  return (
    segmentsIntersect(x0, y0, x1, y1, rect.left, rect.top, rect.right, rect.top)
    || segmentsIntersect(x0, y0, x1, y1, rect.right, rect.top, rect.right, rect.bottom)
    || segmentsIntersect(x0, y0, x1, y1, rect.right, rect.bottom, rect.left, rect.bottom)
    || segmentsIntersect(x0, y0, x1, y1, rect.left, rect.bottom, rect.left, rect.top)
  )
}

export function isQualifiedSwipe(
  segment: CursorSweepSegment,
  config: SwipeThresholdConfig,
): boolean {
  const dx = segment.x1 - segment.x0
  const dy = segment.y1 - segment.y0
  const distancePx = Math.hypot(dx, dy)

  if (!(distancePx >= Math.max(0, config.minDistancePx))) return false
  if (!(segment.velocityPx >= Math.max(0, config.minVelocityPx))) return false
  return true
}
