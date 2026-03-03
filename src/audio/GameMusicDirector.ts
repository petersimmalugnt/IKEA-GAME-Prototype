import { useEffect, useRef } from 'react'
import {
  activateRunSequence,
  updateRunSequenceTime,
} from '@/audio/BackgroundMusicManager'
import { subscribeGameRunClock } from '@/game/GameRunClock'

export function GameMusicDirector(): null {
  const latestEpochRef = useRef(-1)
  const activatedEpochRef = useRef(Number.NEGATIVE_INFINITY)

  useEffect(() => {
    return subscribeGameRunClock((seconds, epoch, running) => {
      latestEpochRef.current = epoch
      if (!running) return
      if (activatedEpochRef.current !== latestEpochRef.current) {
        activatedEpochRef.current = latestEpochRef.current
        activateRunSequence(latestEpochRef.current)
      }
      updateRunSequenceTime(seconds)
    })
  }, [])

  return null
}
