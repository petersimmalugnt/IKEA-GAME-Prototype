import { create } from 'zustand'

export const GAME_PHASES = ['loading', 'playing', 'paused', 'gameOver'] as const
export type GamePhase = (typeof GAME_PHASES)[number]

type GamePhaseState = {
  phase: GamePhase
  setPhase: (phase: GamePhase) => void
  pause: () => void
  resume: () => void
}

export const useGamePhaseStore = create<GamePhaseState>((set, get) => ({
  phase: 'playing',

  setPhase: (phase) => set({ phase }),

  pause: () => {
    if (get().phase === 'playing') set({ phase: 'paused' })
  },

  resume: () => {
    if (get().phase === 'paused') set({ phase: 'playing' })
  },
}))

export function isPlaying(): boolean {
  return useGamePhaseStore.getState().phase === 'playing'
}
