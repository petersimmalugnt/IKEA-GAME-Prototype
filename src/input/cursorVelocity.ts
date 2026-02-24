let screenX = 0
let screenY = 0
let velocityPx = 0
let lastMoveTime = 0

export function updateCursorFromMouseEvent(x: number, y: number): void {
  const now = performance.now()
  const dt = now - lastMoveTime

  if (lastMoveTime > 0 && dt > 0 && dt < 100) {
    const dx = x - screenX
    const dy = y - screenY
    const dist = Math.sqrt(dx * dx + dy * dy)
    velocityPx = (dist / dt) * 1000
  }

  screenX = x
  screenY = y
  lastMoveTime = now
}

export function getCursorScreenPos(): { x: number; y: number } {
  return { x: screenX, y: screenY }
}

export function getCursorVelocityPx(): number {
  return velocityPx
}

export function decayCursorVelocity(delta: number): void {
  velocityPx *= Math.exp(-8 * delta)
}
