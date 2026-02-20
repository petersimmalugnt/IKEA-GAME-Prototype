import { create } from 'zustand'
import type { Vec3 } from '@/settings/GameSettings'

export type LevelNode = {
  id: string
  nodeType: 'object' | 'effector'
  type: string
  position?: Vec3
  rotation?: Vec3
  props: Record<string, unknown>
  children?: LevelNode[]
}

export type LevelData = {
  version: number
  nodes: LevelNode[]
}

/** Convert v1 flat objects format to v2 nodes format. */
function convertV1ToV2(data: { version: number; objects: unknown[] }): LevelData {
  const nodes: LevelNode[] = (data.objects ?? []).map((raw) => {
    const obj = raw as Record<string, unknown>
    return {
      id: (obj.id as string) ?? crypto.randomUUID(),
      nodeType: 'object' as const,
      type: obj.type as string,
      position: obj.position as Vec3 | undefined,
      rotation: obj.rotation as Vec3 | undefined,
      props: (obj.props as Record<string, unknown>) ?? {},
    }
  })
  return { version: 2, nodes }
}

function parseLevelFileJson(raw: unknown): LevelData {
  const data = raw as Record<string, unknown>

  if (Array.isArray(data.nodes)) {
    return { version: Number(data.version) || 2, nodes: data.nodes as LevelNode[] }
  }

  if (Array.isArray(data.objects)) {
    return convertV1ToV2(data as { version: number; objects: unknown[] })
  }

  throw new Error('Invalid level format: missing nodes or objects array')
}

type LevelStoreState = {
  levelData: LevelData | null
  loading: boolean
  error: string | null
  /** Incremented on reload so LevelRenderer remounts physics bodies. */
  levelReloadKey: number
  loadLevel: (filename: string) => Promise<void>
  setLevelData: (data: LevelData) => void
  /** Re-apply current level (deep clone) and remount to reset physics positions. */
  reloadCurrentLevel: () => void
}

export const useLevelStore = create<LevelStoreState>((set, get) => ({
  levelData: null,
  loading: false,
  error: null,
  levelReloadKey: 0,
  loadLevel: async (filename: string) => {
    set({ loading: true, error: null })
    try {
      const response = await fetch(`/levels/${filename}`)
      if (!response.ok) {
        throw new Error(`Failed to load level: ${response.status} ${response.statusText}`)
      }
      const raw: unknown = await response.json()
      const data = parseLevelFileJson(raw)

      set({ levelData: data, loading: false, error: null })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error loading level'
      set({ error: errorMessage, loading: false, levelData: null })
      console.error('Level loading error:', errorMessage)
    }
  },
  setLevelData: (data: LevelData) => {
    set({ levelData: data, loading: false, error: null })
  },
  reloadCurrentLevel: () => {
    const state = get()
    if (!state.levelData) return
    set({
      levelData: structuredClone(state.levelData),
      levelReloadKey: state.levelReloadKey + 1,
    })
  },
}))
