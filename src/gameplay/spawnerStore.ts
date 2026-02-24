import { create } from 'zustand'

export type SpawnedItem = {
  id: string
  position: [number, number, number]
  velocity: [number, number, number]
  colorIndex: number
  radius: number
  templateIndex: number
}

type SpawnerState = {
  items: SpawnedItem[]
  addItem: (item: SpawnedItem) => void
  removeItem: (id: string) => void
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

  clearAll: () => set({ items: [] }),
}))
