import * as THREE from 'three'
import { createContext, useContext, useMemo, useRef, type ReactNode } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGameplayStore } from '@/gameplay/gameplayStore'
import {
  getFrustumCornersOnFloor,
  isPastBottomEdge,
  isPastLeftEdge,
  type FrustumCorners,
} from '@/gameplay/frustumBounds'
import { SETTINGS } from '@/settings/GameSettings'

type BalloonWorldXZ = {
  x: number
  z: number
}

export type BalloonLifecycleTarget = {
  getWorldXZ: () => BalloonWorldXZ | undefined
  isPopped: () => boolean
  onMissed: () => void
}

type BalloonLifecycleEntry = {
  target: BalloonLifecycleTarget
  missApplied: boolean
}

type BalloonLifecycleRegistry = {
  register: (target: BalloonLifecycleTarget) => () => void
}

const DEFAULT_LIFE_MARGIN = 0

const BalloonLifecycleRegistryContext = createContext<BalloonLifecycleRegistry | null>(null)

function normalizeMargin(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.max(0, value)
}

export function useBalloonLifecycleRegistry(): BalloonLifecycleRegistry | null {
  return useContext(BalloonLifecycleRegistryContext)
}

export function BalloonLifecycleRuntime({ children }: { children: ReactNode }) {
  const { camera } = useThree()
  const loseLives = useGameplayStore((state) => state.loseLives)
  const gameOver = useGameplayStore((state) => state.gameOver)
  const entriesRef = useRef<Set<BalloonLifecycleEntry>>(new Set())
  const missQueueRef = useRef<Array<() => void>>([])

  const registry = useMemo<BalloonLifecycleRegistry>(() => ({
    register(target) {
      const entry: BalloonLifecycleEntry = { target, missApplied: false }
      entriesRef.current.add(entry)
      return () => { entriesRef.current.delete(entry) }
    },
  }), [])

  useFrame(() => {
    if (gameOver) return
    const entries = entriesRef.current
    if (entries.size === 0) return

    const rawCorners = getFrustumCornersOnFloor(camera as THREE.OrthographicCamera)
    if (!rawCorners || rawCorners.length !== 4) return
    const corners = rawCorners as FrustumCorners

    const lifeMargin = normalizeMargin(SETTINGS.gameplay.balloons.sensors.lifeMargin, DEFAULT_LIFE_MARGIN)
    const lifeLoss = Math.max(0, Math.trunc(SETTINGS.gameplay.lives.lossPerMiss))

    const missQueue = missQueueRef.current
    missQueue.length = 0

    entries.forEach((entry) => {
      if (entry.missApplied) return
      if (entry.target.isPopped()) return

      const worldPosition = entry.target.getWorldXZ()
      if (!worldPosition) return

      const pastLife = (
        isPastLeftEdge(corners, worldPosition.x, worldPosition.z, lifeMargin)
        || isPastBottomEdge(corners, worldPosition.x, worldPosition.z, lifeMargin)
      )

      if (pastLife) {
        entry.missApplied = true
        if (lifeLoss > 0) loseLives(lifeLoss)
        missQueue.push(entry.target.onMissed)
      }
    })

    missQueue.forEach((callback) => callback())
  })

  return (
    <BalloonLifecycleRegistryContext.Provider value={registry}>
      {children}
    </BalloonLifecycleRegistryContext.Provider>
  )
}
