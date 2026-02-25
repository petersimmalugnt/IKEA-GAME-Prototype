import { useEffect, useRef } from 'react'
import { subscribeToScorePops } from '@/input/scorePopEmitter'

const POP_DURATION_MS = 900
const FLOAT_DISTANCE = 48
const FONT_SIZE = 28

type ScorePop = {
  text: string
  x: number
  y: number
  createdAt: number
}

export function ScorePopCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const pops: ScorePop[] = []
    let rafId = 0

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

    const unsubscribe = subscribeToScorePops(({ amount, x, y }) => {
      pops.push({ text: `+${amount}`, x, y, createdAt: performance.now() })
    })

    const frame = () => {
      rafId = requestAnimationFrame(frame)

      const now = performance.now()
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      ctx.clearRect(0, 0, w, h)

      for (let i = pops.length - 1; i >= 0; i--) {
        const pop = pops[i]
        const elapsed = now - pop.createdAt
        if (elapsed >= POP_DURATION_MS) {
          pops.splice(i, 1)
          continue
        }

        const t = elapsed / POP_DURATION_MS
        const alpha = 1 - t
        const floatY = pop.y - FLOAT_DISTANCE * t

        ctx.save()
        ctx.globalAlpha = alpha
        ctx.font = `bold ${FONT_SIZE}px "Roboto Mono", monospace`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'

        ctx.strokeStyle = 'rgba(0,0,0,0.7)'
        ctx.lineWidth = 4
        ctx.lineJoin = 'round'
        ctx.strokeText(pop.text, pop.x, floatY)

        ctx.fillStyle = '#fff'
        ctx.fillText(pop.text, pop.x, floatY)
        ctx.restore()
      }
    }

    rafId = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(rafId)
      unsubscribe()
      resizeObserver.disconnect()
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
