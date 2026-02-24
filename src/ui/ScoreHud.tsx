import { useGameplayStore } from '@/gameplay/gameplayStore'
import { SETTINGS } from '@/settings/GameSettings'

export function ScoreHud() {
  const score = useGameplayStore((state) => state.score)
  const lives = useGameplayStore((state) => state.lives)
  const maxLives = SETTINGS.gameplay.lives.startingLives

  const hearts = '❤️'.repeat(lives) + '🖤'.repeat(Math.max(0, maxLives - lives))

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
        display: 'flex',
        gap: 8,
        alignItems: 'center',
      }}
    >
      <span>{`Score: ${score}`}</span>
      <span>{hearts}</span>
    </div>
  )
}
