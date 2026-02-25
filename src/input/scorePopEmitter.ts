export type ScorePopEvent = {
  amount: number
  x: number
  y: number
}

type Listener = (event: ScorePopEvent) => void

const listeners = new Set<Listener>()

export function emitScorePop(event: ScorePopEvent): void {
  for (const listener of listeners) {
    listener(event)
  }
}

export function subscribeToScorePops(cb: Listener): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}
