import { useFrame } from '@react-three/fiber'
import { useGameplayStore } from '@/gameplay/gameplayStore'
import { isPlaying } from '@/game/gamePhaseStore'

export function ContagionRuntime() {
  const flushContagionQueue = useGameplayStore((state) => state.flushContagionQueue)

  useFrame(() => {
    if (!isPlaying()) return
    flushContagionQueue()
  })

  return null
}
