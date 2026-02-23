import { create } from 'zustand'
import type { LevelData } from '@/levelStore'
import { parseLevelFileJson } from '@/levelStore'

const DEFAULT_TILE_DEPTH = 12.8

export type LevelSegment = {
  id: string
  filename: string
  data: LevelData
  zOffset: number
}

export function getTileDepth(data: LevelData): number {
  const unitSize = data.unitSize ?? 0.1
  const gridZ = data.gridSize?.[1] ?? 128
  return gridZ * unitSize
}

type LevelTilingState = {
  availableLevels: Map<string, LevelData>
  segments: LevelSegment[]
  nextZOffset: number
  segmentIdCounter: number
  initialized: boolean
  error: string | null
  initialize: (files: string[]) => Promise<void>
  spawnNextSegment: () => void
  cullSegment: (id: string) => void
}

export const useLevelTilingStore = create<LevelTilingState>((set, get) => ({
  availableLevels: new Map(),
  segments: [],
  nextZOffset: 0,
  segmentIdCounter: 0,
  initialized: false,
  error: null,

  initialize: async (files: string[]) => {
    if (files.length === 0) {
      set({ initialized: true, error: 'No level files configured for tiling' })
      return
    }
    const next = new Map<string, LevelData>()
    for (const filename of files) {
      try {
        const response = await fetch(`/levels/${filename}`)
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
        const raw: unknown = await response.json()
        const data = parseLevelFileJson(raw)
        next.set(filename, data)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        set({ error: `Failed to load ${filename}: ${msg}` })
        console.error('Level tiling load error:', msg)
        return
      }
    }
    set({ availableLevels: next, initialized: true, error: null })
  },

  spawnNextSegment: () => {
    const { availableLevels, segments, nextZOffset, segmentIdCounter } = get()
    if (availableLevels.size === 0) return

    const filenames = Array.from(availableLevels.keys())
    const filename = filenames[Math.floor(Math.random() * filenames.length)]
    const data = availableLevels.get(filename)!
    const depth = getTileDepth(data)

    const id = `seg-${segmentIdCounter}`
    const segment: LevelSegment = { id, filename, data, zOffset: nextZOffset }

    set({
      segments: [...segments, segment],
      nextZOffset: nextZOffset - depth,
      segmentIdCounter: segmentIdCounter + 1,
    })
  },

  cullSegment: (id: string) => {
    set((state) => ({
      segments: state.segments.filter((s) => s.id !== id),
    }))
  },
}))

export function getDefaultTileDepth(): number {
  return DEFAULT_TILE_DEPTH
}
