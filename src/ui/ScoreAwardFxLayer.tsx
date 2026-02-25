import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import type { CSSProperties } from 'react'
import { SCORE_AWARD_LIFETIME_MS, useGameplayStore } from '@/gameplay/gameplayStore'
import './ScoreAwardFxLayer.css'

const BURST_ROTATIONS = [0, 45, 90, 135, 180, 225, 270, 315]

export function ScoreAwardFxLayer() {
  const scoreAwardFx = useGameplayStore((state) => state.scoreAwardFx)
  const pruneScoreAwardFx = useGameplayStore((state) => state.pruneScoreAwardFx)

  useFrame(() => {
    pruneScoreAwardFx()
  })

  if (scoreAwardFx.length === 0) return null

  return (
    <>
      {scoreAwardFx.map((entry) => {
        const style = {
          '--score-award-duration': `${SCORE_AWARD_LIFETIME_MS}ms`,
          '--score-award-scale': entry.source === 'collision' ? 0.5 : 1,
        } as CSSProperties

        return (
          <Html
            key={entry.id}
            center
            position={[entry.worldPosition.x, entry.worldPosition.y, entry.worldPosition.z]}
            zIndexRange={[240, 0]}
            style={{ pointerEvents: 'none' }}
          >
            <div className="score-award-fx" style={style}>
              <span className="score-award-fx__value">{`+${entry.amount}`}</span>
              <span className="score-award-fx__burst" aria-hidden>
                {BURST_ROTATIONS.map((rotation) => (
                  <span
                    key={`${entry.id}-${rotation}`}
                    className="score-award-fx__ray"
                    style={{ transform: `translate(-50%, -50%) rotate(${rotation}deg)` }}
                  />
                ))}
              </span>
            </div>
          </Html>
        )
      })}
    </>
  )
}
