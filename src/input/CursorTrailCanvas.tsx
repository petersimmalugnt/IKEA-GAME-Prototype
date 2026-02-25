import { useEffect, useRef } from 'react'
import { SETTINGS } from '@/settings/GameSettings'
import { updateCursorFromMouseEvent, decayCursorVelocity } from '@/input/cursorVelocity'

const MAX_TRAIL_POINTS = 96

type ScreenPoint = { x: number; y: number; time: number }

export function CursorTrailCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const history: ScreenPoint[] = []
    let rafId = 0
    let lastFrameTime = performance.now()

    const syncSize = () => {
      const dpr = window.devicePixelRatio ?? 1
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.scale(dpr, dpr)
    }

    syncSize()

    const resizeObserver = new ResizeObserver(syncSize)
    resizeObserver.observe(canvas)

    const onMouseMove = (e: MouseEvent) => {
      updateCursorFromMouseEvent(e.clientX, e.clientY)
      history.push({ x: e.clientX, y: e.clientY, time: performance.now() })
    }

    window.addEventListener('mousemove', onMouseMove)
    document.documentElement.style.cursor = 'none'

    const frame = () => {
      rafId = requestAnimationFrame(frame)

      const now = performance.now()
      const delta = (now - lastFrameTime) / 1000
      lastFrameTime = now

      decayCursorVelocity(delta)

      // Evict old points
      const maxAgeMs = SETTINGS.cursor.trail.maxAge * 1000
      while (history.length > 1 && now - history[0].time > maxAgeMs) {
        history.shift()
      }
      if (history.length > MAX_TRAIL_POINTS) {
        history.splice(0, history.length - MAX_TRAIL_POINTS)
      }

      const w = canvas.clientWidth
      const h = canvas.clientHeight
      ctx.clearRect(0, 0, w, h)

      if (history.length < 2) return

      ctx.beginPath()
      ctx.moveTo(history[0].x, history[0].y)
      for (let i = 1; i < history.length; i++) {
        ctx.lineTo(history[i].x, history[i].y)
      }
      ctx.strokeStyle = SETTINGS.cursor.trail.color
      ctx.lineWidth = SETTINGS.cursor.trail.lineWidth ?? 4
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.globalAlpha = 0.9
      ctx.stroke()
    }

    rafId = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('mousemove', onMouseMove)
      resizeObserver.disconnect()
      document.documentElement.style.cursor = ''
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    />
  )
}
