import { create } from 'zustand'
import { SETTINGS } from '@/settings/GameSettings'

export type SpawnedItemDescriptor = {
  id: string
  colorIndex: number
  radius: number
  templateIndex: number
}

export type SpawnedItemMotion = {
  position: [number, number, number]
  velocity: [number, number, number]
}

type PoolSlot = {
  active: boolean
  descriptor: SpawnedItemDescriptor
}

const itemMotion = new Map<string, SpawnedItemMotion>()

export function getItemMotion(id: string): SpawnedItemMotion | undefined {
  return itemMotion.get(id)
}

export function setItemMotion(id: string, position: [number, number, number], velocity: [number, number, number]) {
  itemMotion.set(id, { position, velocity })
}

export function clearItemMotion(id: string) {
  itemMotion.delete(id)
}

function createPool(size: number): PoolSlot[] {
  return Array.from({ length: size }, () => ({
    active: false,
    descriptor: { id: '', colorIndex: 0, radius: 0, templateIndex: 0 },
  }))
}

type SpawnerState = {
  pool: PoolSlot[]
  activeCount: number
  epoch: number
  items: SpawnedItemDescriptor[]
  addItem: (descriptor: SpawnedItemDescriptor, position: [number, number, number], velocity: [number, number, number]) => void
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

  addItem: (descriptor, position, velocity) => {
    const state = get()
    const slot = state.pool.find((s) => !s.active)
    if (!slot) return

    slot.active = true
    slot.descriptor.id = descriptor.id
    slot.descriptor.colorIndex = descriptor.colorIndex
    slot.descriptor.radius = descriptor.radius
    slot.descriptor.templateIndex = descriptor.templateIndex

    setItemMotion(descriptor.id, position, velocity)

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
    clearItemMotion(id)

    set({
      activeCount: state.activeCount - 1,
      epoch: state.epoch + 1,
      items: deriveItems(state.pool),
    })
  },

  clearAll: () => {
    const state = get()
    for (const slot of state.pool) {
      if (slot.active) clearItemMotion(slot.descriptor.id)
      slot.active = false
    }
    set({ activeCount: 0, epoch: state.epoch + 1, items: [] })
  },
}))
