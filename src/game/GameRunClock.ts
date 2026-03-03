import { useFrame } from '@react-three/fiber'

type GameRunClockListener = (seconds: number, epoch: number, running: boolean) => void

const listeners = new Set<GameRunClockListener>()

let runSeconds = 0
let runEpoch = 0
let runClockRunning = false

function notifyListeners(): void {
  if (listeners.size === 0) return
  listeners.forEach((listener) => {
    listener(runSeconds, runEpoch, runClockRunning)
  })
}

export function resetGameRunClock(): void {
  runSeconds = 0
  runEpoch += 1
  notifyListeners()
}

export function setGameRunClockRunning(running: boolean): void {
  const next = running === true
  if (runClockRunning === next) return
  runClockRunning = next
  notifyListeners()
}

export function isGameRunClockRunning(): boolean {
  return runClockRunning
}

export function getGameRunClockSeconds(): number {
  return runSeconds
}

export function getGameRunClockEpoch(): number {
  return runEpoch
}

export function subscribeGameRunClock(listener: GameRunClockListener): () => void {
  listeners.add(listener)
  listener(runSeconds, runEpoch, runClockRunning)
  return () => {
    listeners.delete(listener)
  }
}

export function GameRunClockRuntime(): null {
  useFrame((_, delta) => {
    if (!runClockRunning) return
    if (!(delta > 0)) return
    runSeconds += delta
    notifyListeners()
  })

  return null
}
