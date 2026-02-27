import { create } from 'zustand'
import { playSteel } from '@/audio/SoundManager'
import { SETTINGS, resolveMaterialColorIndex } from '@/settings/GameSettings'
import { onEntityUnregister } from '@/entities/entityStore'
import { emitScorePop } from '@/input/scorePopEmitter'

export type ContagionRecord = {
  lineageId: string
  colorIndex: number
  carrier: boolean
  activatedAt: number
  seededFrom?: string
}

export type ScreenPos = { x: number; y: number }

export type ContagionCollisionEntity = {
  entityId?: string
  contagionCarrier?: boolean
  contagionInfectable?: boolean
  colorIndex?: number
  screenPos?: ScreenPos
}

type NormalizedCollisionEntity = {
  entityId: string
  carrier: boolean
  infectable: boolean
  colorIndex: number
  screenPos?: ScreenPos
}

type PendingPair = {
  a: NormalizedCollisionEntity
  b: NormalizedCollisionEntity
}

type GameplayState = {
  score: number
  lives: number
  gameOver: boolean
  runEndSequence: number
  sequence: number
  contagionEpoch: number
  contagionColorsByEntityId: Record<string, number>
  reset: () => void
  addScore: (delta: number) => void
  loseLife: () => void
  loseLives: (delta: number) => void
  setGameOver: (value: boolean) => void
  removeEntities: (ids: string[]) => void
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
  return SETTINGS.gameplay.score.lockOnGameOver === true
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
    screenPos: raw.screenPos,
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

type ContagionMaps = {
  records: Map<string, ContagionRecord>
  pendingPairs: Map<string, PendingPair>
}

function createContagionMaps(): ContagionMaps {
  return {
    records: new Map(),
    pendingPairs: new Map(),
  }
}

let maps = createContagionMaps()

export const useGameplayStore = create<GameplayState>((set, get) => ({
  score: 0,
  lives: getInitialLives(),
  gameOver: false,
  runEndSequence: 0,
  sequence: 0,
  contagionEpoch: 0,
  contagionColorsByEntityId: {},

  reset: () => {
    maps = createContagionMaps()
    set({
      score: 0,
      lives: getInitialLives(),
      gameOver: false,
      runEndSequence: 0,
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
      return { score: state.score + normalizedDelta }
    })
  },

  loseLife: () => {
    useGameplayStore.getState().loseLives(SETTINGS.gameplay.lives.lossPerMiss)
  },

  loseLives: (delta) => {
    const normalizedDelta = normalizeNonNegativeInt(delta, 0)
    if (normalizedDelta === 0) return
    set((state) => {
      if (state.gameOver) return state
      const nextLives = Math.max(0, state.lives - normalizedDelta)
      const didRunEnd = nextLives <= 0
      const autoResetLives = SETTINGS.gameplay.lives.autoReset === true
      const nextGameOver = didRunEnd && !autoResetLives
      const didEnterGameOver = nextGameOver && !state.gameOver
      const shouldResetOnRunEnd = didRunEnd && SETTINGS.gameplay.score.resetOnRunEnd === true
      const shouldResetOnGameOver = didEnterGameOver && SETTINGS.gameplay.score.resetOnGameOver === true
      const nextScore = (shouldResetOnRunEnd || shouldResetOnGameOver) ? 0 : state.score

      if (didRunEnd && autoResetLives) {
        return {
          ...state,
          score: nextScore,
          lives: getInitialLives(),
          runEndSequence: state.runEndSequence + 1,
        }
      }

      return {
        ...state,
        score: nextScore,
        lives: nextLives,
        gameOver: nextGameOver,
        runEndSequence: didRunEnd ? state.runEndSequence + 1 : state.runEndSequence,
      }
    })
  },

  setGameOver: (value) => {
    const nextValue = value === true
    set((state) => {
      if (state.gameOver === nextValue) return state
      const shouldResetScore = nextValue && SETTINGS.gameplay.score.resetOnGameOver === true
      return {
        ...state,
        score: shouldResetScore ? 0 : state.score,
        gameOver: nextValue,
      }
    })
  },

  removeEntities: (ids) => {
    let changed = false
    for (const id of ids) {
      if (maps.records.delete(id)) changed = true
    }
    set((state) => {
      const next = { ...state.contagionColorsByEntityId }
      for (const id of ids) {
        if (id in next) {
          delete next[id]
          changed = true
        }
      }
      if (!changed) return state
      return { contagionColorsByEntityId: next }
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
    if (maps.pendingPairs.has(pairKey)) return

    maps.pendingPairs.set(pairKey, { a: entityA, b: entityB })
  },

  flushContagionQueue: () => {
    if (isScoreLockedOnGameOver() && get().gameOver) {
      maps.pendingPairs.clear()
      return
    }
    if (maps.pendingPairs.size === 0) return

    const pendingPairs = Array.from(maps.pendingPairs.values())
    maps.pendingPairs.clear()

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
        const current = maps.records.get(entity.entityId)
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
        maps.records.set(entity.entityId, seeded)
        setEntityColor(entity.entityId, seeded.colorIndex)
        return seeded
      }

      pendingPairs.forEach(({ a: entityA, b: entityB }) => {
        const contagionA = ensureCarrier(entityA) ?? maps.records.get(entityA.entityId)
        const contagionB = ensureCarrier(entityB) ?? maps.records.get(entityB.entityId)

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

        const targetCurrent = maps.records.get(target.entityId)
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
        maps.records.set(target.entityId, {
          lineageId: nextTargetLineage,
          colorIndex: nextTargetColor,
          carrier: true,
          activatedAt: nextSequence,
          seededFrom: source.entityId,
        })
        setEntityColor(target.entityId, nextTargetColor)
        const infectionScore = Math.max(0, contagionSettings.scorePerInfection)
        nextScore += infectionScore
        if (infectionScore > 0 && target.screenPos) {
          emitScorePop({ amount: infectionScore, ...target.screenPos })
        }
      })

      if (!contagionChanged) {
        return state
      }

      playSteel()

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

onEntityUnregister((id) => {
  useGameplayStore.getState().removeEntities([id])
})
