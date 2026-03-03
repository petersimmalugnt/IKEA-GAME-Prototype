import { AUDIO_SETTINGS } from '@/audio/AudioSettings'
import { AUDIO_BANK_IDS, type AudioBankId } from '@/audio/AudioSettings.types'

type CategoryState = {
  buffers: AudioBuffer[]
  index: number
}

let ctx: AudioContext | null = null
const categories = new Map<AudioBankId, CategoryState>()
let preloaded = false
let resumeListenerAttached = false
let masterGain: GainNode | null = null
let sfxBusGain: GainNode | null = null
let musicBusGain: GainNode | null = null

function normalizeVolume(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.max(0, value)
}

function attachResumeListener(): void {
  if (resumeListenerAttached) return
  resumeListenerAttached = true

  const resume = () => {
    if (ctx && ctx.state === "suspended") {
      ctx.resume()
    }
    window.removeEventListener('mousedown', resume)
    window.removeEventListener('pointerdown', resume)
    window.removeEventListener('touchstart', resume)
    window.removeEventListener('keydown', resume)
  }

  window.addEventListener('mousedown', resume, { once: false })
  window.addEventListener('pointerdown', resume, { once: false })
  window.addEventListener('touchstart', resume, { once: false })
  window.addEventListener('keydown', resume, { once: false })
}

export function getOrCreateAudioContext(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext()
    attachResumeListener()
  }
  ensureBusGraph(ctx)
  syncAudioMixerGainsFromSettings()
  if (ctx.state === 'suspended') {
    ctx.resume()
  }
  return ctx
}

function ensureBusGraph(audioCtx: AudioContext): void {
  if (masterGain && sfxBusGain && musicBusGain) return
  masterGain = audioCtx.createGain()
  sfxBusGain = audioCtx.createGain()
  musicBusGain = audioCtx.createGain()
  sfxBusGain.connect(masterGain)
  musicBusGain.connect(masterGain)
  masterGain.connect(audioCtx.destination)
}

export function syncAudioMixerGainsFromSettings(): void {
  if (!ctx || !masterGain || !sfxBusGain || !musicBusGain) return

  const enabled = AUDIO_SETTINGS.enabled === true
  masterGain.gain.value = enabled
    ? normalizeVolume(AUDIO_SETTINGS.mix.masterVolume, 1)
    : 0
  sfxBusGain.gain.value = normalizeVolume(AUDIO_SETTINGS.mix.sfxMasterVolume, 1)
  musicBusGain.gain.value = normalizeVolume(AUDIO_SETTINGS.mix.musicMasterVolume, 1)
}

export function getMusicBusNode(): GainNode {
  const audioCtx = getOrCreateAudioContext()
  ensureBusGraph(audioCtx)
  if (!musicBusGain) {
    throw new Error('Music bus is not initialized.')
  }
  return musicBusGain
}

async function decodeFile(
  audioCtx: AudioContext,
  url: string,
): Promise<AudioBuffer | null> {
  try {
    const response = await fetch(url)
    const arrayBuffer = await response.arrayBuffer()
    return await audioCtx.decodeAudioData(arrayBuffer)
  } catch {
    console.warn(`[SoundManager] Failed to load: ${url}`)
    return null
  }
}

async function loadAudioBankInternal(
  audioCtx: AudioContext,
  bankId: AudioBankId,
): Promise<void> {
  const settings = AUDIO_SETTINGS.banks[bankId]
  const results = await Promise.all(
    settings.files.map((file) => decodeFile(audioCtx, file)),
  )
  const buffers = results.filter((b): b is AudioBuffer => b !== null)
  categories.set(bankId, { buffers, index: 0 })
}

export async function preloadAudioBanks(): Promise<void> {
  if (preloaded) return
  preloaded = true

  const audioCtx = getOrCreateAudioContext()
  await Promise.all(AUDIO_BANK_IDS.map((bankId) => loadAudioBankInternal(audioCtx, bankId)))
}

export function playAudioBank(bankId: AudioBankId, volumeScale = 1): void {
  if (!AUDIO_SETTINGS.enabled) return

  const state = categories.get(bankId)
  if (!state || state.buffers.length === 0) return

  const audioCtx = getOrCreateAudioContext()
  ensureBusGraph(audioCtx)
  const buffer = state.buffers[state.index]
  state.index = (state.index + 1) % state.buffers.length

  const source = audioCtx.createBufferSource()
  source.buffer = buffer

  const gain = audioCtx.createGain()
  const bankVolume = AUDIO_SETTINGS.banks[bankId].volume
  gain.gain.value = bankVolume * volumeScale

  source.connect(gain)
  if (!sfxBusGain) {
    throw new Error('SFX bus is not initialized.')
  }
  gain.connect(sfxBusGain)
  source.start()
}

export function hasLoadedAudioBank(bankId: AudioBankId): boolean {
  const state = categories.get(bankId)
  return Boolean(state && state.buffers.length > 0)
}

export async function reloadAudioBank(bankId: AudioBankId): Promise<void> {
  const audioCtx = getOrCreateAudioContext()
  await loadAudioBankInternal(audioCtx, bankId)
  preloaded = true
}

export async function reloadAllAudioBanks(): Promise<void> {
  const audioCtx = getOrCreateAudioContext()
  await Promise.all(AUDIO_BANK_IDS.map((bankId) => loadAudioBankInternal(audioCtx, bankId)))
  preloaded = true
}
