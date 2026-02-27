import type { CSSProperties } from 'react'
import { useGameplayStore } from '@/gameplay/gameplayStore'
import { SETTINGS, getPaletteEntry } from '@/settings/GameSettings'

function formatScore(value: number): string {
  const truncated = Number.isFinite(value) ? Math.trunc(value) : 0
  const sign = truncated < 0 ? '-' : ''
  const digits = Math.abs(truncated).toString()
  return `${sign}${digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}`
}

export function ScoreHud() {
  const uiWhite = '#fff'
  const score = useGameplayStore((state) => state.score)
  const lastRunScore = useGameplayStore((state) => state.lastRunScore)
  const lives = useGameplayStore((state) => state.lives)
  const gameOver = useGameplayStore((state) => state.gameOver)
  const maxLives = SETTINGS.gameplay.lives.initial
  const secondaryColor = 'rgba(255, 255, 255, 0.2)'
  const consumedLives = Math.max(0, maxLives - lives)

  const hudTextStyle: CSSProperties = {
    fontFamily: '"Instrument Sans", sans-serif',
    fontSize: '1.5rem',
    lineHeight: 1,
    letterSpacing: '0em',
    textTransform: 'uppercase',
  }

  return (
    <>
      <div
        style={{
          position: 'absolute',
          top: '1.5rem',
          left: '1.5rem',
          zIndex: 30,
          pointerEvents: 'none',
          ...hudTextStyle,
          display: 'flex',
          gap: '.5em',
        }}
      >
        <span style={{ color: secondaryColor }}>Score</span>
        <span style={{ color: uiWhite }}>{formatScore(score)}</span>
      </div>

      <div
        style={{
          position: 'absolute',
          top: '3.25rem',
          left: '1.5rem',
          zIndex: 30,
          pointerEvents: 'none',
          ...hudTextStyle,
          fontSize: '.75rem',
          display: 'flex',
          gap: '.5em',
        }}
      >
        <span style={{ color: uiWhite }}>Last Run</span>
        <span style={{ color: uiWhite }}>{formatScore(lastRunScore)}</span>
      </div>

      <div
        style={{
          position: 'absolute',
          top: '1.5rem',
          right: '1.5rem',
          zIndex: 30,
          pointerEvents: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: '0.125em',
          ...hudTextStyle,
        }}
      >
        {Array.from({ length: lives }, (_, index) => (
          <span
            key={`life-active-${index}`}
            className="material-icons"
            style={{
              color: uiWhite,
              fontSize: '1.5rem',
              lineHeight: '1em',
            }}
          >
            favorite
          </span>
        ))}
        {Array.from({ length: consumedLives }, (_, index) => (
          <span
            key={`life-consumed-${index}`}
            className="material-icons"
            style={{
              color: secondaryColor,
              fontSize: '1.5rem',
              lineHeight: '1em',
            }}
          >
            favorite
          </span>
        ))}
      </div>

      {gameOver ? (
        <div
          style={{
            position: 'absolute',
            top: '3.3rem',
            left: '1.5rem',
            zIndex: 30,
            pointerEvents: 'none',
            color: secondaryColor,
            ...hudTextStyle,
          }}
        >
          Game Over
        </div>
      ) : null}
    </>
  )
}
