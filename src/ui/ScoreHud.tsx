import { useGameplayStore } from '@/gameplay/gameplayStore'

export function ScoreHud() {
  const score = useGameplayStore((state) => state.score)

  return (
    <div
      style={{
        position: 'absolute',
        top: 16,
        left: 16,
        zIndex: 30,
        pointerEvents: 'none',
        padding: '6px 10px',
        borderRadius: 6,
        background: 'rgba(0, 0, 0, 0.4)',
        color: '#fff',
        fontFamily: 'Roboto Mono, monospace',
        fontSize: 14,
        lineHeight: 1,
      }}
    >
      {`Score: ${score}`}
    </div>
  )
}
