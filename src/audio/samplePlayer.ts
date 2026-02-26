import type { SoundPoolName } from '@/settings/GameSettings.types'

type SamplePoolState = {
  buffers: AudioBuffer[]
  nextVoiceIndex: number
  activeSources: Array<AudioBufferSourceNode | null>
  activeGains: Array<GainNode | null>
}

const pools = new Map<SoundPoolName, SamplePoolState>()

function stopVoice(state: SamplePoolState, voiceIndex: number): void {
  const activeSource = state.activeSources[voiceIndex]
  const activeGain = state.activeGains[voiceIndex]

  if (activeSource) {
    activeSource.onended = null
    try {
      activeSource.stop()
    } catch {
      // no-op: source may already be stopped
    }
    try {
      activeSource.disconnect()
    } catch {
      // no-op
    }
    state.activeSources[voiceIndex] = null
  }

  if (activeGain) {
    try {
      activeGain.disconnect()
    } catch {
      // no-op
    }
    state.activeGains[voiceIndex] = null
  }
}

function createPoolState(buffers: AudioBuffer[]): SamplePoolState {
  return {
    buffers,
    nextVoiceIndex: 0,
    activeSources: new Array(buffers.length).fill(null),
    activeGains: new Array(buffers.length).fill(null),
  }
}

export function setSamplePoolBuffers(name: SoundPoolName, buffers: AudioBuffer[]): void {
  const existing = pools.get(name)
  if (existing) {
    for (let voiceIndex = 0; voiceIndex < existing.activeSources.length; voiceIndex += 1) {
      stopVoice(existing, voiceIndex)
    }
  }
  pools.set(name, createPoolState(buffers))
}

export function pingSamplePool(
  audioCtx: AudioContext,
  destination: AudioNode,
  name: SoundPoolName,
  gainValue: number,
): void {
  const state = pools.get(name)
  if (!state || state.buffers.length === 0) return

  const voiceIndex = state.nextVoiceIndex
  state.nextVoiceIndex = (state.nextVoiceIndex + 1) % state.buffers.length

  stopVoice(state, voiceIndex)

  const source = audioCtx.createBufferSource()
  source.buffer = state.buffers[voiceIndex]

  const gain = audioCtx.createGain()
  gain.gain.value = gainValue

  source.connect(gain)
  gain.connect(destination)

  state.activeSources[voiceIndex] = source
  state.activeGains[voiceIndex] = gain

  source.onended = () => {
    if (state.activeSources[voiceIndex] !== source) return
    try {
      source.disconnect()
    } catch {
      // no-op
    }
    try {
      gain.disconnect()
    } catch {
      // no-op
    }
    state.activeSources[voiceIndex] = null
    state.activeGains[voiceIndex] = null
  }

  source.start()
}
