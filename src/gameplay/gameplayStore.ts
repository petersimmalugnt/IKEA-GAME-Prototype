import { create } from 'zustand'
import { SETTINGS, resolveMaterialColorIndex } from '@/settings/GameSettings'

export type ContagionRecord = {
  lineageId: string
  colorIndex: number
  carrier: boolean
  activatedAt: number
  seededFrom?: string
}

export type ContagionCollisionEntity = {
  entityId?: string
  contagionCarrier?: boolean
  contagionInfectable?: boolean
  colorIndex?: number
}

type NormalizedCollisionEntity = {
  entityId: string
  carrier: boolean
  infectable: boolean
  colorIndex: number
}

type PendingPair = {
  a: NormalizedCollisionEntity
  b: NormalizedCollisionEntity
}

type GameplayState = {
  score: number
  lives: number
  gameOver: boolean
  sequence: number
  contagionEpoch: number
  contagionColorsByEntityId: Record<string, number>
  reset: () => void
  addScore: (delta: number) => void
  loseLives: (delta: number) => void
  setGameOver: (value: boolean) => void
  enqueueCollisionPair: (
    entityA: ContagionCollisionEntity | null | undefined,
    entityB: ContagionCollisionEntity | null | undefined,
  ) => void
  flushContagionQueue: () => void
}

function normalizeNonNegativeInt(value: number, fallback = 0): number {
  if (!Number.isFinite(value)) return fallback
  return Math.max(0, Math.trunc(value))
}

function isScoreLockedOnGameOver(): boolean {
  return SETTINGS.gameplay.lives.lockScoreOnGameOver === true
}

function getInitialLives(): number {
  return normalizeNonNegativeInt(SETTINGS.gameplay.lives.initial, 0)
}

function normalizeCollisionEntity(raw: ContagionCollisionEntity | null | undefined): NormalizedCollisionEntity | null {
  if (!raw) return null
  if (typeof raw.entityId !== 'string') return null
  const entityId = raw.entityId.trim()
  if (!entityId) return null

  return {
    entityId,
    carrier: raw.contagionCarrier === true,
    infectable: raw.contagionInfectable !== false,
    colorIndex: resolveMaterialColorIndex(raw.colorIndex ?? 0),
  }
}

function resolvePairKey(entityAId: string, entityBId: string): string {
  return entityAId < entityBId
    ? `${entityAId}|${entityBId}`
    : `${entityBId}|${entityAId}`
}

function sourceWinsByLww(
  sourceId: string,
  sourceActivatedAt: number,
  targetId: string,
  targetActivatedAt: number,
): boolean {
  if (sourceActivatedAt !== targetActivatedAt) {
    return sourceActivatedAt > targetActivatedAt
  }
  return sourceId.localeCompare(targetId) > 0
}

const contagionRecords = new Map<string, ContagionRecord>()
const pendingCollisionPairs = new Map<string, PendingPair>()

export const useGameplayStore = create<GameplayState>((set, get) => ({
  score: 0,
  lives: getInitialLives(),
  gameOver: false,
  sequence: 0,
  contagionEpoch: 0,
  contagionColorsByEntityId: {},

  reset: () => {
    contagionRecords.clear()
    pendingCollisionPairs.clear()
    set({
      score: 0,
      lives: getInitialLives(),
      gameOver: false,
      sequence: 0,
      contagionEpoch: 0,
      contagionColorsByEntityId: {},
    })
  },

  addScore: (delta) => {
    const normalizedDelta = normalizeNonNegativeInt(delta, 0)
    if (normalizedDelta === 0) return

    set((state) => {
      if (isScoreLockedOnGameOver() && state.gameOver) return state
      return {
        score: state.score + normalizedDelta,
      }
    })
  },

  loseLives: (delta) => {
    const normalizedDelta = normalizeNonNegativeInt(delta, 0)
    if (normalizedDelta === 0) return

    set((state) => {
      if (state.gameOver) return state
      const nextLives = Math.max(0, state.lives - normalizedDelta)
      return {
        ...state,
        lives: nextLives,
        gameOver: nextLives <= 0,
      }
    })
  },

  setGameOver: (value) => {
    const nextValue = value === true
    set((state) => {
      if (state.gameOver === nextValue) return state
      return {
        ...state,
        gameOver: nextValue,
      }
    })
  },

  enqueueCollisionPair: (rawA, rawB) => {
    const contagionSettings = SETTINGS.gameplay.contagion
    if (!contagionSettings.enabled) return
    if (isScoreLockedOnGameOver() && get().gameOver) return

    const entityA = normalizeCollisionEntity(rawA)
    const entityB = normalizeCollisionEntity(rawB)
    if (!entityA || !entityB) return
    if (entityA.entityId === entityB.entityId) return

    const pairKey = resolvePairKey(entityA.entityId, entityB.entityId)
    if (pendingCollisionPairs.has(pairKey)) return

    pendingCollisionPairs.set(pairKey, { a: entityA, b: entityB })
  },

  flushContagionQueue: () => {
    if (isScoreLockedOnGameOver() && get().gameOver) {
      pendingCollisionPairs.clear()
      return
    }
    if (pendingCollisionPairs.size === 0) return

    const pendingPairs = Array.from(pendingCollisionPairs.values())
    pendingCollisionPairs.clear()

    set((state) => {
      const contagionSettings = SETTINGS.gameplay.contagion
      if (!contagionSettings.enabled) return state
      if (isScoreLockedOnGameOver() && state.gameOver) return state

      let nextSequence = state.sequence
      let nextScore = state.score
      const nextColorsByEntityId = state.contagionColorsByEntityId
      let contagionChanged = false
      const setEntityColor = (entityId: string, colorIndex: number) => {
        if (nextColorsByEntityId[entityId] === colorIndex) return
        nextColorsByEntityId[entityId] = colorIndex
      }
      const ensureCarrier = (entity: NormalizedCollisionEntity): ContagionRecord | undefined => {
        const current = contagionRecords.get(entity.entityId)
        if (current) return current
        if (!entity.carrier) return undefined

        contagionChanged = true
        nextSequence += 1
        const seeded: ContagionRecord = {
          lineageId: entity.entityId,
          colorIndex: entity.colorIndex,
          carrier: true,
          activatedAt: nextSequence,
          seededFrom: 'carrier',
        }
        contagionRecords.set(entity.entityId, seeded)
        setEntityColor(entity.entityId, seeded.colorIndex)
        return seeded
      }

      pendingPairs.forEach(({ a: entityA, b: entityB }) => {
        const contagionA = ensureCarrier(entityA) ?? contagionRecords.get(entityA.entityId)
        const contagionB = ensureCarrier(entityB) ?? contagionRecords.get(entityB.entityId)

        const hasCarrierA = Boolean(contagionA?.carrier)
        const hasCarrierB = Boolean(contagionB?.carrier)

        if (!hasCarrierA && !hasCarrierB) {
          return
        }

        let source: NormalizedCollisionEntity
        let target: NormalizedCollisionEntity
        let sourceRecord: ContagionRecord

        if (hasCarrierA && !hasCarrierB) {
          source = entityA
          target = entityB
          sourceRecord = contagionA!
        } else if (!hasCarrierA && hasCarrierB) {
          source = entityB
          target = entityA
          sourceRecord = contagionB!
        } else {
          if (contagionA!.lineageId === contagionB!.lineageId) {
            return
          }

          const aWins = sourceWinsByLww(
            entityA.entityId,
            contagionA!.activatedAt,
            entityB.entityId,
            contagionB!.activatedAt,
          )
          source = aWins ? entityA : entityB
          target = aWins ? entityB : entityA
          sourceRecord = aWins ? contagionA! : contagionB!
        }

        if (!target.infectable) {
          return
        }

        const targetCurrent = contagionRecords.get(target.entityId)
        const nextTargetColor = sourceRecord.colorIndex
        const nextTargetLineage = sourceRecord.lineageId

        if (
          targetCurrent
          && targetCurrent.carrier
          && targetCurrent.colorIndex === nextTargetColor
          && targetCurrent.lineageId === nextTargetLineage
        ) {
          return
        }

        contagionChanged = true
        nextSequence += 1
        contagionRecords.set(target.entityId, {
          lineageId: nextTargetLineage,
          colorIndex: nextTargetColor,
          carrier: true,
          activatedAt: nextSequence,
          seededFrom: source.entityId,
        })
        setEntityColor(target.entityId, nextTargetColor)
        nextScore += Math.max(0, contagionSettings.scorePerInfection)
      })

      if (!contagionChanged) {
        return state
      }

      return {
        ...state,
        score: nextScore,
        sequence: nextSequence,
        contagionEpoch: state.contagionEpoch + 1,
        contagionColorsByEntityId: nextColorsByEntityId,
      }
    })
  },
}))

export function useContagionColorOverride(entityId: string | undefined): number | undefined {
  return useGameplayStore((state) => {
    if (!entityId) return undefined
    return state.contagionColorsByEntityId[entityId]
  })
}
