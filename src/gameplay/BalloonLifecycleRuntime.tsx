import * as THREE from 'three'
import { createContext, useContext, useMemo, useRef, type ReactNode } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGameplayStore } from '@/gameplay/gameplayStore'
import {
  getLatestCursorSweepSeq,
  readCursorSweepSegment,
  type CursorSweepSegment,
} from '@/input/cursorVelocity'
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

export type BalloonLifecyclePopMeta = {
  xVelocityPx: number
}

export type BalloonLifecycleTarget = {
  getWorldXZ: () => BalloonWorldXZ | undefined
  getWorldPopCenter: (out: THREE.Vector3) => boolean
  getWorldPopRadius: () => number
  requestPop: (meta: BalloonLifecyclePopMeta) => void
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
const SEGMENT_EPSILON = 1e-6

const BalloonLifecycleRegistryContext = createContext<BalloonLifecycleRegistry | null>(null)

function normalizeMargin(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.max(0, value)
}

function pointSegmentDistanceSq(
  px: number,
  py: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): number {
  const dx = x1 - x0
  const dy = y1 - y0
  const segmentLengthSq = dx * dx + dy * dy
  if (segmentLengthSq <= SEGMENT_EPSILON) {
    const qx = px - x0
    const qy = py - y0
    return qx * qx + qy * qy
  }

  const t = Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / segmentLengthSq))
  const closestX = x0 + dx * t
  const closestY = y0 + dy * t
  const qx = px - closestX
  const qy = py - closestY
  return qx * qx + qy * qy
}

function segmentIntersectsCircle(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  cx: number,
  cy: number,
  radiusSq: number,
  radiusAabb: number,
): boolean {
  const minX = x0 < x1 ? x0 : x1
  const maxX = x0 > x1 ? x0 : x1
  const minY = y0 < y1 ? y0 : y1
  const maxY = y0 > y1 ? y0 : y1

  if (cx < minX - radiusAabb || cx > maxX + radiusAabb) return false
  if (cy < minY - radiusAabb || cy > maxY + radiusAabb) return false

  return pointSegmentDistanceSq(cx, cy, x0, y0, x1, y1) <= radiusSq
}

export function useBalloonLifecycleRegistry(): BalloonLifecycleRegistry | null {
  return useContext(BalloonLifecycleRegistryContext)
}

export function BalloonLifecycleRuntime({ children }: { children: ReactNode }) {
  const { camera, gl } = useThree()
  const loseLives = useGameplayStore((state) => state.loseLives)
  const gameOver = useGameplayStore((state) => state.gameOver)
  const entriesRef = useRef<Set<BalloonLifecycleEntry>>(new Set())
  const missQueueRef = useRef<Array<() => void>>([])
  const popQueueRef = useRef<Array<BalloonLifecycleTarget>>([])
  const lastSweepSeqRef = useRef(0)
  const sweepSegmentRef = useRef<CursorSweepSegment>({
    seq: 0,
    timeMs: 0,
    x0: 0,
    y0: 0,
    x1: 0,
    y1: 0,
    velocityPx: 0,
    velocityXPx: 0,
  })
  const popMetaRef = useRef<BalloonLifecyclePopMeta>({ xVelocityPx: 0 })
  const popCenterWorldRef = useRef(new THREE.Vector3())
  const popOffsetWorldRef = useRef(new THREE.Vector3())
  const popCenterNdcRef = useRef(new THREE.Vector3())
  const popOffsetNdcRef = useRef(new THREE.Vector3())
  const cameraRightRef = useRef(new THREE.Vector3())

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

    const latestSweepSeq = getLatestCursorSweepSeq()
    if (latestSweepSeq > lastSweepSeqRef.current) {
      const canvasRect = gl.domElement.getBoundingClientRect()
      const canvasWidth = canvasRect.width
      const canvasHeight = canvasRect.height

      if (canvasWidth > 0 && canvasHeight > 0) {
        const popQueue = popQueueRef.current
        const popCenterWorld = popCenterWorldRef.current
        const popOffsetWorld = popOffsetWorldRef.current
        const popCenterNdc = popCenterNdcRef.current
        const popOffsetNdc = popOffsetNdcRef.current
        const cameraRight = cameraRightRef.current
        const sweepSegment = sweepSegmentRef.current

        camera.updateMatrixWorld()
        cameraRight.setFromMatrixColumn(camera.matrixWorld, 0)
        const cameraRightLengthSq = cameraRight.lengthSq()

        if (cameraRightLengthSq > SEGMENT_EPSILON) {
          cameraRight.multiplyScalar(1 / Math.sqrt(cameraRightLengthSq))

          for (
            let sweepSeq = lastSweepSeqRef.current + 1;
            sweepSeq <= latestSweepSeq;
            sweepSeq += 1
          ) {
            if (!readCursorSweepSegment(sweepSeq, sweepSegment)) continue
            if (sweepSegment.velocityPx < SETTINGS.cursor.minPopVelocity) continue

            const x0Local = sweepSegment.x0 - canvasRect.left
            const y0Local = sweepSegment.y0 - canvasRect.top
            const x1Local = sweepSegment.x1 - canvasRect.left
            const y1Local = sweepSegment.y1 - canvasRect.top

            const segmentMinX = x0Local < x1Local ? x0Local : x1Local
            const segmentMaxX = x0Local > x1Local ? x0Local : x1Local
            const segmentMinY = y0Local < y1Local ? y0Local : y1Local
            const segmentMaxY = y0Local > y1Local ? y0Local : y1Local
            if (
              segmentMaxX < 0
              || segmentMinX > canvasWidth
              || segmentMaxY < 0
              || segmentMinY > canvasHeight
            ) {
              continue
            }

            popQueue.length = 0
            entries.forEach((entry) => {
              if (entry.missApplied) return
              if (entry.target.isPopped()) return
              if (!entry.target.getWorldPopCenter(popCenterWorld)) return

              const radiusWorld = entry.target.getWorldPopRadius()
              if (!(radiusWorld > 0) || !Number.isFinite(radiusWorld)) return

              popCenterNdc.copy(popCenterWorld).project(camera)
              if (
                !Number.isFinite(popCenterNdc.x)
                || !Number.isFinite(popCenterNdc.y)
                || !Number.isFinite(popCenterNdc.z)
              ) {
                return
              }
              if (popCenterNdc.z < -1 || popCenterNdc.z > 1) return

              const centerX = ((popCenterNdc.x + 1) * 0.5) * canvasWidth
              const centerY = ((1 - popCenterNdc.y) * 0.5) * canvasHeight

              popOffsetWorld.copy(popCenterWorld).addScaledVector(cameraRight, radiusWorld)
              popOffsetNdc.copy(popOffsetWorld).project(camera)
              const radiusPxX = ((popOffsetNdc.x - popCenterNdc.x) * 0.5) * canvasWidth
              const radiusPxY = ((popOffsetNdc.y - popCenterNdc.y) * 0.5) * canvasHeight
              const radiusPxSq = radiusPxX * radiusPxX + radiusPxY * radiusPxY
              if (!(radiusPxSq > 0) || !Number.isFinite(radiusPxSq)) return

              const radiusAabb = Math.abs(radiusPxX) + Math.abs(radiusPxY)
              if (
                segmentIntersectsCircle(
                  x0Local,
                  y0Local,
                  x1Local,
                  y1Local,
                  centerX,
                  centerY,
                  radiusPxSq,
                  radiusAabb,
                )
              ) {
                popQueue.push(entry.target)
              }
            })

            if (popQueue.length > 0) {
              const popMeta = popMetaRef.current
              popMeta.xVelocityPx = sweepSegment.velocityXPx
              for (let i = 0; i < popQueue.length; i += 1) {
                popQueue[i]?.requestPop(popMeta)
              }
            }
          }
        }
      }

      lastSweepSeqRef.current = latestSweepSeq
    }

    missQueue.forEach((callback) => callback())
  })

  return (
    <BalloonLifecycleRegistryContext.Provider value={registry}>
      {children}
    </BalloonLifecycleRegistryContext.Provider>
  )
}
