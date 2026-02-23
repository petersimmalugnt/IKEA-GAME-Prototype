import { create } from 'zustand'

export type SpawnedItem = {
  id: string
  position: [number, number, number]
  velocity: [number, number, number]
  colorIndex: number
  radius: number
}

type SpawnerState = {
  items: SpawnedItem[]
  addItem: (item: SpawnedItem) => void
  removeItem: (id: string) => void
  updatePositions: (delta: number) => void
  clearAll: () => void
}

export const useSpawnerStore = create<SpawnerState>((set) => ({
  items: [],

  addItem: (item) =>
    set((state) => ({
      items: [...state.items, item],
    })),

  removeItem: (id) =>
    set((state) => ({
      items: state.items.filter((it) => it.id !== id),
    })),

  updatePositions: (delta) =>
    set((state) => ({
      items: state.items.map((item) => ({
        ...item,
        position: [
          item.position[0] + item.velocity[0] * delta,
          item.position[1] + item.velocity[1] * delta,
          item.position[2] + item.velocity[2] * delta,
        ],
      })),
    })),

  clearAll: () => set({ items: [] }),
}))
