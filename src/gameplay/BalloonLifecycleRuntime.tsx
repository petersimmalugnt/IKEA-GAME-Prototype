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
  onCleanupRequested: () => void
}

type BalloonLifecycleEntry = {
  target: BalloonLifecycleTarget
  missApplied: boolean
  cleanupApplied: boolean
}

type BalloonLifecycleRegistry = {
  register: (target: BalloonLifecycleTarget) => () => void
}

const DEFAULT_LIFE_MARGIN = 0
const DEFAULT_CLEANUP_MARGIN = 0.35

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
  const gameOverCleanupAppliedRef = useRef(false)
  const missQueueRef = useRef<Array<() => void>>([])
  const cleanupQueueRef = useRef<Array<() => void>>([])

  const registry = useMemo<BalloonLifecycleRegistry>(() => ({
    register(target) {
      const entry: BalloonLifecycleEntry = {
        target,
        missApplied: false,
        cleanupApplied: false,
      }

      entriesRef.current.add(entry)

      return () => {
        entriesRef.current.delete(entry)
      }
    },
  }), [])

  useFrame(() => {
    const entries = entriesRef.current
    if (entries.size === 0) {
      if (!gameOver) {
        gameOverCleanupAppliedRef.current = false
      }
      return
    }

    const cleanupQueue = cleanupQueueRef.current
    const missQueue = missQueueRef.current
    cleanupQueue.length = 0
    missQueue.length = 0

    if (gameOver) {
      if (gameOverCleanupAppliedRef.current) return
      gameOverCleanupAppliedRef.current = true

      entries.forEach((entry) => {
        if (entry.cleanupApplied) return
        entry.cleanupApplied = true
        cleanupQueue.push(entry.target.onCleanupRequested)
      })

      cleanupQueue.forEach((callback) => callback())
      return
    }
    gameOverCleanupAppliedRef.current = false

    const rawCorners = getFrustumCornersOnFloor(camera as THREE.OrthographicCamera)
    if (!rawCorners || rawCorners.length !== 4) return
    const corners = rawCorners as FrustumCorners

    const lifeMargin = normalizeMargin(SETTINGS.gameplay.balloons.sensors.lifeMargin, DEFAULT_LIFE_MARGIN)
    const cleanupMarginRaw = normalizeMargin(SETTINGS.gameplay.balloons.sensors.cleanupMargin, DEFAULT_CLEANUP_MARGIN)
    const cleanupMargin = Math.max(lifeMargin, cleanupMarginRaw)
    const lifeLoss = Math.max(0, Math.trunc(SETTINGS.gameplay.lives.lossPerMiss))

    entries.forEach((entry) => {
      if (entry.cleanupApplied) return
      if (entry.target.isPopped()) return

      const worldPosition = entry.target.getWorldXZ()
      if (!worldPosition) return

      const pastLife = (
        isPastLeftEdge(corners, worldPosition.x, worldPosition.z, lifeMargin)
        || isPastBottomEdge(corners, worldPosition.x, worldPosition.z, lifeMargin)
      )
      const pastCleanup = (
        isPastLeftEdge(corners, worldPosition.x, worldPosition.z, cleanupMargin)
        || isPastBottomEdge(corners, worldPosition.x, worldPosition.z, cleanupMargin)
      )

      if (pastLife && !entry.missApplied) {
        entry.missApplied = true
        if (lifeLoss > 0) {
          loseLives(lifeLoss)
        }
        missQueue.push(entry.target.onMissed)
      }

      if (pastCleanup && !entry.cleanupApplied) {
        entry.cleanupApplied = true
        cleanupQueue.push(entry.target.onCleanupRequested)
      }
    })

    missQueue.forEach((callback) => callback())
    cleanupQueue.forEach((callback) => callback())
  })

  return (
    <BalloonLifecycleRegistryContext.Provider value={registry}>
      {children}
    </BalloonLifecycleRegistryContext.Provider>
  )
}
