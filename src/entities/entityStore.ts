import { useEffect } from 'react'
import { create } from 'zustand'

export type EntityType = 'player' | 'rigid_body' | 'spawned_item' | 'level_node'

export type EntityRecord = {
  id: string
  type: EntityType
  metadata?: Record<string, unknown>
}

type EntityStoreState = {
  entities: Map<string, EntityRecord>
  epoch: number
  register: (id: string, type: EntityType, metadata?: Record<string, unknown>) => void
  unregister: (id: string) => void
  getEntitiesByType: (type: EntityType) => EntityRecord[]
  reset: () => void
}

let idCounter = 0

export function generateEntityId(prefix: string): string {
  idCounter += 1
  return `${prefix}-${idCounter}`
}

export function resetEntityIdCounter() {
  idCounter = 0
}

const unregisterListeners = new Set<(id: string) => void>()

export function onEntityUnregister(listener: (id: string) => void): () => void {
  unregisterListeners.add(listener)
  return () => { unregisterListeners.delete(listener) }
}

export const useEntityStore = create<EntityStoreState>((set, get) => ({
  entities: new Map(),
  epoch: 0,

  register: (id, type, metadata) => {
    set((state) => {
      const next = new Map(state.entities)
      next.set(id, { id, type, metadata })
      return { entities: next, epoch: state.epoch + 1 }
    })
  },

  unregister: (id) => {
    const state = get()
    if (!state.entities.has(id)) return

    unregisterListeners.forEach((listener) => listener(id))

    set((s) => {
      const next = new Map(s.entities)
      next.delete(id)
      return { entities: next, epoch: s.epoch + 1 }
    })
  },

  getEntitiesByType: (type) => {
    const entities = get().entities
    const result: EntityRecord[] = []
    entities.forEach((record) => {
      if (record.type === type) result.push(record)
    })
    return result
  },

  reset: () => {
    resetEntityIdCounter()
    set({ entities: new Map(), epoch: 0 })
  },
}))

export function useEntityRegistration(
  id: string | undefined,
  type: EntityType,
  metadata?: Record<string, unknown>,
) {
  const register = useEntityStore((s) => s.register)
  const unregister = useEntityStore((s) => s.unregister)

  useEffect(() => {
    if (!id) return
    register(id, type, metadata)
    return () => { unregister(id) }
  }, [id, type, register, unregister])
}
