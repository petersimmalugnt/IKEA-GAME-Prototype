import { SETTINGS } from "@/settings/GameSettings";
import type { SoundCategorySettings } from "@/settings/GameSettings";
import type { SoundPoolName } from "@/settings/GameSettings.types";
import { pingSamplePool, setSamplePoolBuffers } from "@/audio/samplePlayer";

let ctx: AudioContext | null = null;
let preloaded = false;
let resumeListenerAttached = false;

function attachResumeListener(): void {
  if (resumeListenerAttached) return;
  resumeListenerAttached = true;

  const resume = () => {
    if (ctx && ctx.state === "suspended") {
      ctx.resume();
    }
    window.removeEventListener("mousedown", resume);
    window.removeEventListener("pointerdown", resume);
    window.removeEventListener("touchstart", resume);
    window.removeEventListener("keydown", resume);
  };

  window.addEventListener("mousedown", resume, { once: false });
  window.addEventListener("pointerdown", resume, { once: false });
  window.addEventListener("touchstart", resume, { once: false });
  window.addEventListener("keydown", resume, { once: false });
}

function getOrCreateContext(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
    attachResumeListener();
  }
  if (ctx.state === "suspended") {
    ctx.resume();
  }
  return ctx;
}

async function decodeFile(
  audioCtx: AudioContext,
  url: string,
): Promise<AudioBuffer | null> {
  try {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    return await audioCtx.decodeAudioData(arrayBuffer);
  } catch {
    console.warn(`[SoundManager] Failed to load: ${url}`);
    return null;
  }
}

async function loadCategory(
  audioCtx: AudioContext,
  name: SoundPoolName,
  settings: SoundCategorySettings,
): Promise<void> {
  const results = await Promise.all(
    settings.files.map((file) => decodeFile(audioCtx, file)),
  );
  const buffers = results.filter((b): b is AudioBuffer => b !== null);
  setSamplePoolBuffers(name, buffers);
}

export async function preload(): Promise<void> {
  if (preloaded) return;
  preloaded = true;

  const audioCtx = getOrCreateContext();
  const { sounds } = SETTINGS;

  await Promise.all([
    loadCategory(audioCtx, "pop", sounds.pop),
    loadCategory(audioCtx, "felt", sounds.felt),
    loadCategory(audioCtx, "steel", sounds.steel),
    loadCategory(audioCtx, "swoosh", sounds.swoosh),
  ]);
}

function playCategory(name: SoundPoolName, volumeScale = 1): void {
  if (!SETTINGS.sounds.enabled) return;

  const audioCtx = getOrCreateContext();
  pingSamplePool(
    audioCtx,
    audioCtx.destination,
    name,
    SETTINGS.sounds[name].volume * volumeScale,
  );
}

export function pingSoundPool(name: SoundPoolName, volumeScale = 1): void {
  playCategory(name, volumeScale);
}

export function playPop(): void {
  playCategory("pop");
}

export function playFelt(): void {
  playCategory("felt");
}

export function playSteel(): void {
  playCategory("steel");
}

export function playSwoosh(volumeScale = 1): void {
  playCategory("swoosh", volumeScale);
}
