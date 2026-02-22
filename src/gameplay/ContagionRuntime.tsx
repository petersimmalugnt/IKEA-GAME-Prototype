import { useFrame } from '@react-three/fiber'
import { useGameplayStore } from '@/gameplay/gameplayStore'

export function ContagionRuntime() {
  const flushContagionQueue = useGameplayStore((state) => state.flushContagionQueue)

  useFrame(() => {
    flushContagionQueue()
  })

  return null
}
