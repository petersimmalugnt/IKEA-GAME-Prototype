import { SETTINGS } from '@/settings/GameSettings'
import type {
  HighScoreDatabaseFallbackMode,
  HighScoreStorageMode,
} from '@/settings/GameSettings.types'
import { normalizeHighScoreInitials } from '@/ui/highScoreEntry/highScoreEntryAlphabet'

export type HighScoreSubmissionReason = 'submitted' | 'timeout'

export type HighScoreSubmissionRecord = {
  runId: string
  score: number
  initials: string
  submittedAtMs: number
  reason: HighScoreSubmissionReason
  submittedAtIso: string
}

export type HighScoreSubmissionResult = {
  accepted: true
  rank: number | null
  totalEntries: number
  storageMode: HighScoreStorageMode
}

export type HighScorePreviewPlacement = {
  rank: number | null
  totalEntries: number
  storageMode: HighScoreStorageMode
}

export type HighScoreSnapshotListener = (snapshot: readonly HighScoreSubmissionRecord[]) => void

type PersistedHighScoreRecord = {
  runId: string
  score: number
  initials: string
  submittedAtMs: number
  reason: HighScoreSubmissionReason
}

type HighScoreStoreConfig = {
  maxEntries: number
  localStorageKey: string
}

const DEFAULT_LOCAL_STORAGE_KEY = 'ikea-game.highscores.v1'
const DEFAULT_MAX_ENTRIES = 256

const listeners = new Set<HighScoreSnapshotListener>()
let storageEventBound = false
let localStorageUnavailableWarned = false
let localStorageWriteWarned = false
let databaseStubWarned = false

function normalizeNonNegativeInt(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.max(0, Math.trunc(value))
}

function resolveConfiguredStorageMode(): HighScoreStorageMode {
  const configured = SETTINGS.gameplay.highScore.storageMode
  if (configured === 'local_storage' || configured === 'memory' || configured === 'database') {
    return configured
  }
  return 'local_storage'
}

function resolveConfiguredFallbackMode(): HighScoreDatabaseFallbackMode {
  const configured = SETTINGS.gameplay.highScore.databaseFallbackMode
  if (configured === 'local_storage' || configured === 'memory') {
    return configured
  }
  return 'local_storage'
}

function resolveConfiguredMaxEntries(): number {
  return Math.max(1, normalizeNonNegativeInt(SETTINGS.gameplay.highScore.maxEntries, DEFAULT_MAX_ENTRIES))
}

function resolveConfiguredLocalStorageKey(): string {
  const raw = SETTINGS.gameplay.highScore.localStorageKey
  if (typeof raw !== 'string') return DEFAULT_LOCAL_STORAGE_KEY
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : DEFAULT_LOCAL_STORAGE_KEY
}

function resolveConfig(): HighScoreStoreConfig {
  return {
    maxEntries: resolveConfiguredMaxEntries(),
    localStorageKey: resolveConfiguredLocalStorageKey(),
  }
}

function isLocalStorageAvailable(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return typeof window.localStorage !== 'undefined'
  } catch {
    return false
  }
}

function compareRecords(a: HighScoreSubmissionRecord, b: HighScoreSubmissionRecord): number {
  if (a.score !== b.score) return b.score - a.score
  if (a.submittedAtMs !== b.submittedAtMs) return a.submittedAtMs - b.submittedAtMs
  return a.runId.localeCompare(b.runId)
}

function toPersistedRecord(record: HighScoreSubmissionRecord): PersistedHighScoreRecord {
  return {
    runId: record.runId,
    score: record.score,
    initials: record.initials,
    submittedAtMs: record.submittedAtMs,
    reason: record.reason,
  }
}

function normalizeReason(value: unknown): HighScoreSubmissionReason {
  return value === 'timeout' ? 'timeout' : 'submitted'
}

function normalizeRecordInput(
  raw: Partial<HighScoreSubmissionRecord> & Pick<HighScoreSubmissionRecord, 'score' | 'initials'>,
): HighScoreSubmissionRecord {
  const submittedAtMs = normalizeNonNegativeInt(raw.submittedAtMs ?? Date.now(), Date.now())
  const normalizedRunId = typeof raw.runId === 'string' && raw.runId.trim().length > 0
    ? raw.runId.trim()
    : `run-${submittedAtMs}`
  const score = normalizeNonNegativeInt(raw.score, 0)
  const initials = normalizeHighScoreInitials(raw.initials)
  const reason = normalizeReason(raw.reason)

  return {
    runId: normalizedRunId,
    score,
    initials,
    submittedAtMs,
    reason,
    submittedAtIso: new Date(submittedAtMs).toISOString(),
  }
}

function normalizePersistedRecord(raw: unknown): HighScoreSubmissionRecord | null {
  if (!raw || typeof raw !== 'object') return null
  const record = raw as Partial<PersistedHighScoreRecord>
  if (typeof record.runId !== 'string') return null

  return normalizeRecordInput({
    runId: record.runId,
    score: normalizeNonNegativeInt(record.score ?? 0, 0),
    initials: typeof record.initials === 'string' ? record.initials : 'AAA',
    submittedAtMs: normalizeNonNegativeInt(record.submittedAtMs ?? Date.now(), Date.now()),
    reason: normalizeReason(record.reason),
  })
}

function sortAndTrimRecords(records: HighScoreSubmissionRecord[], maxEntries: number): void {
  records.sort(compareRecords)
  if (records.length > maxEntries) {
    records.length = maxEntries
  }
}

function cloneSnapshot(records: readonly HighScoreSubmissionRecord[]): readonly HighScoreSubmissionRecord[] {
  return records.map((record) => ({ ...record }))
}

function resolveRank(records: readonly HighScoreSubmissionRecord[], submitted: HighScoreSubmissionRecord): number | null {
  const index = records.findIndex((entry) => (
    entry.runId === submitted.runId
    && entry.submittedAtMs === submitted.submittedAtMs
    && entry.initials === submitted.initials
    && entry.score === submitted.score
    && entry.reason === submitted.reason
  ))
  return index >= 0 ? index + 1 : null
}

class MemoryHighScoreStore {
  private records: HighScoreSubmissionRecord[] = []

  getSnapshot(maxEntries: number): readonly HighScoreSubmissionRecord[] {
    sortAndTrimRecords(this.records, maxEntries)
    return this.records
  }

  submit(record: HighScoreSubmissionRecord, maxEntries: number): { rank: number | null, totalEntries: number } {
    this.records.push(record)
    sortAndTrimRecords(this.records, maxEntries)
    return {
      rank: resolveRank(this.records, record),
      totalEntries: this.records.length,
    }
  }

  clear(): void {
    this.records.length = 0
  }
}

class LocalStorageHighScoreStore {
  private key = DEFAULT_LOCAL_STORAGE_KEY
  private maxEntries = DEFAULT_MAX_ENTRIES
  private loaded = false
  private records: HighScoreSubmissionRecord[] = []

  configure(config: HighScoreStoreConfig): void {
    const changed = this.key !== config.localStorageKey || this.maxEntries !== config.maxEntries
    this.key = config.localStorageKey
    this.maxEntries = config.maxEntries
    if (changed) {
      this.loaded = false
    }
  }

  invalidate(): void {
    this.loaded = false
  }

  getSnapshot(): readonly HighScoreSubmissionRecord[] {
    this.ensureLoaded()
    return this.records
  }

  submit(record: HighScoreSubmissionRecord): { rank: number | null, totalEntries: number } {
    this.ensureLoaded()
    this.records.push(record)
    sortAndTrimRecords(this.records, this.maxEntries)
    this.persist()
    return {
      rank: resolveRank(this.records, record),
      totalEntries: this.records.length,
    }
  }

  clear(): void {
    this.ensureLoaded()
    this.records.length = 0
    this.persist()
  }

  private ensureLoaded(): void {
    if (this.loaded) return
    this.loaded = true
    this.records = []

    if (!isLocalStorageAvailable()) return
    try {
      const rawJson = window.localStorage.getItem(this.key)
      if (!rawJson) return
      const parsed = JSON.parse(rawJson) as unknown
      if (!Array.isArray(parsed)) {
        console.warn('[highScoreStoreRuntime] Invalid localStorage payload for high scores, resetting.')
        this.persistSafe()
        return
      }

      for (let i = 0; i < parsed.length; i += 1) {
        const normalized = normalizePersistedRecord(parsed[i])
        if (!normalized) continue
        this.records.push(normalized)
      }

      sortAndTrimRecords(this.records, this.maxEntries)
      this.persistSafe()
    } catch (error) {
      console.warn('[highScoreStoreRuntime] Failed to parse persisted high scores, resetting.', error)
      this.records = []
      this.persistSafe()
    }
  }

  private persistSafe(): void {
    try {
      this.persist()
    } catch (error) {
      console.warn('[highScoreStoreRuntime] Failed to persist sanitized high score snapshot.', error)
    }
  }

  private persist(): void {
    const payload = this.records.map(toPersistedRecord)
    window.localStorage.setItem(this.key, JSON.stringify(payload))
  }
}

const memoryStore = new MemoryHighScoreStore()
const localStorageStore = new LocalStorageHighScoreStore()

function resolvePreferredStorageMode(): HighScoreStorageMode {
  const configuredMode = resolveConfiguredStorageMode()
  if (configuredMode !== 'database') return configuredMode

  if (!databaseStubWarned) {
    databaseStubWarned = true
    console.warn('[highScoreStoreRuntime] "database" mode is not implemented yet, using configured fallback.')
  }
  return resolveConfiguredFallbackMode()
}

function resolveEffectiveStorageMode(): HighScoreStorageMode {
  const preferredMode = resolvePreferredStorageMode()
  if (preferredMode === 'memory') return 'memory'

  if (isLocalStorageAvailable()) return 'local_storage'

  if (!localStorageUnavailableWarned) {
    localStorageUnavailableWarned = true
    console.warn('[highScoreStoreRuntime] localStorage unavailable, falling back to in-memory high score store.')
  }
  return 'memory'
}

function emitSnapshotChanged(): void {
  if (listeners.size === 0) return
  const snapshot = getHighScoreSnapshot()
  for (const listener of listeners) {
    listener(snapshot)
  }
}

function handleStorageEvent(event: StorageEvent): void {
  if (typeof window === 'undefined') return
  if (event.storageArea !== window.localStorage) return

  const localStorageKey = resolveConfiguredLocalStorageKey()
  if (event.key !== null && event.key !== localStorageKey) return

  localStorageStore.invalidate()
  emitSnapshotChanged()
}

function ensureStorageEventListener(): void {
  if (storageEventBound || typeof window === 'undefined') return
  window.addEventListener('storage', handleStorageEvent)
  storageEventBound = true
}

function maybeReleaseStorageEventListener(): void {
  if (!storageEventBound || listeners.size > 0 || typeof window === 'undefined') return
  window.removeEventListener('storage', handleStorageEvent)
  storageEventBound = false
}

function resolvePlacement(
  snapshot: readonly HighScoreSubmissionRecord[],
  candidate: HighScoreSubmissionRecord,
  maxEntries: number,
): { rank: number | null, totalEntries: number } {
  const records = snapshot.map((entry) => ({ ...entry }))
  records.push(candidate)
  sortAndTrimRecords(records, maxEntries)
  return {
    rank: resolveRank(records, candidate),
    totalEntries: records.length,
  }
}

export function submitHighScore(record: HighScoreSubmissionRecord): HighScoreSubmissionResult {
  const normalizedRecord = normalizeRecordInput(record)
  const config = resolveConfig()
  const effectiveMode = resolveEffectiveStorageMode()

  if (effectiveMode === 'local_storage') {
    localStorageStore.configure(config)
    try {
      const result = localStorageStore.submit(normalizedRecord)
      emitSnapshotChanged()
      return {
        accepted: true,
        rank: result.rank,
        totalEntries: result.totalEntries,
        storageMode: 'local_storage',
      }
    } catch (error) {
      if (!localStorageWriteWarned) {
        localStorageWriteWarned = true
        console.warn('[highScoreStoreRuntime] Failed to write high score to localStorage, falling back to memory.', error)
      }
    }
  }

  const memoryResult = memoryStore.submit(normalizedRecord, config.maxEntries)
  emitSnapshotChanged()
  return {
    accepted: true,
    rank: memoryResult.rank,
    totalEntries: memoryResult.totalEntries,
    storageMode: 'memory',
  }
}

export function getHighScoreSnapshot(): readonly HighScoreSubmissionRecord[] {
  const config = resolveConfig()
  const effectiveMode = resolveEffectiveStorageMode()
  if (effectiveMode === 'local_storage') {
    localStorageStore.configure(config)
    return cloneSnapshot(localStorageStore.getSnapshot())
  }
  return cloneSnapshot(memoryStore.getSnapshot(config.maxEntries))
}

export function getHighScorePreviewPlacement(score: number): HighScorePreviewPlacement {
  const config = resolveConfig()
  const effectiveMode = resolveEffectiveStorageMode()
  const snapshot = getHighScoreSnapshot()

  const previewRecord = normalizeRecordInput({
    runId: `preview-${Date.now()}`,
    score: normalizeNonNegativeInt(score, 0),
    initials: 'AAA',
    submittedAtMs: Date.now(),
    reason: 'submitted',
  })

  const placement = resolvePlacement(snapshot, previewRecord, config.maxEntries)
  return {
    rank: placement.rank,
    totalEntries: placement.totalEntries,
    storageMode: effectiveMode,
  }
}

export function clearHighScoreSnapshot(): void {
  const config = resolveConfig()
  const effectiveMode = resolveEffectiveStorageMode()
  if (effectiveMode === 'local_storage') {
    localStorageStore.configure(config)
    try {
      localStorageStore.clear()
    } catch (error) {
      console.warn('[highScoreStoreRuntime] Failed to clear localStorage high score snapshot.', error)
    }
  } else {
    memoryStore.clear()
  }
  emitSnapshotChanged()
}

export function subscribeHighScoreSnapshot(listener: HighScoreSnapshotListener): () => void {
  listeners.add(listener)
  ensureStorageEventListener()
  listener(getHighScoreSnapshot())

  return () => {
    listeners.delete(listener)
    maybeReleaseStorageEventListener()
  }
}
