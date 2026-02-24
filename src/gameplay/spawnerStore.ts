import { create } from 'zustand'
import { SETTINGS } from '@/settings/GameSettings'

export type SpawnedItemDescriptor = {
  id: string
  radius: number
  templateIndex: number
  position: [number, number, number]
}

type PoolSlot = {
  active: boolean
  descriptor: SpawnedItemDescriptor
}

function createPool(size: number): PoolSlot[] {
  return Array.from({ length: size }, () => ({
    active: false,
    descriptor: { id: '', radius: 0, templateIndex: 0, position: [0, 0, 0] },
  }))
}

type SpawnerState = {
  pool: PoolSlot[]
  activeCount: number
  epoch: number
  items: SpawnedItemDescriptor[]
  addItem: (descriptor: SpawnedItemDescriptor) => void
  removeItem: (id: string) => void
  clearAll: () => void
}

function deriveItems(pool: PoolSlot[]): SpawnedItemDescriptor[] {
  const result: SpawnedItemDescriptor[] = []
  for (const slot of pool) {
    if (slot.active) result.push(slot.descriptor)
  }
  return result
}

export const useSpawnerStore = create<SpawnerState>((set, get) => ({
  pool: createPool(SETTINGS.spawner.maxItems),
  activeCount: 0,
  epoch: 0,
  items: [],

  addItem: (descriptor) => {
    const state = get()
    const slot = state.pool.find((s) => !s.active)
    if (!slot) return

    slot.active = true
    slot.descriptor.id = descriptor.id
    slot.descriptor.radius = descriptor.radius
    slot.descriptor.templateIndex = descriptor.templateIndex
    slot.descriptor.position = descriptor.position

    set({
      activeCount: state.activeCount + 1,
      epoch: state.epoch + 1,
      items: deriveItems(state.pool),
    })
  },

  removeItem: (id) => {
    const state = get()
    const slot = state.pool.find((s) => s.active && s.descriptor.id === id)
    if (!slot) return

    slot.active = false

    set({
      activeCount: state.activeCount - 1,
      epoch: state.epoch + 1,
      items: deriveItems(state.pool),
    })
  },

  clearAll: () => {
    const state = get()
    for (const slot of state.pool) {
      slot.active = false
    }
    set({ activeCount: 0, epoch: state.epoch + 1, items: [] })
  },
}))
