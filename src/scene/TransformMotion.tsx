import * as THREE from 'three'
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type MutableRefObject,
  type ReactNode,
} from 'react'
import { useFrame, type ThreeElements } from '@react-three/fiber'
import type { Vec3 } from '@/settings/GameSettings'
import { applyEasing, type EasingName } from '@/utils/easing'

export const TRANSFORM_MOTION_AXES = ['x', 'y', 'z'] as const
export const TRANSFORM_MOTION_LOOP_MODES = ['none', 'loop', 'pingpong'] as const

export type AxisName = (typeof TRANSFORM_MOTION_AXES)[number]
export type LoopMode = (typeof TRANSFORM_MOTION_LOOP_MODES)[number]
type AxisRange = [number, number]
type AxisValueMap = Partial<Record<AxisName, number>>
type AxisRangeMap = Partial<Record<AxisName, AxisRange>>
type Vec3Like = Vec3 | AxisValueMap
type PerAxisOverride<T> = T | Partial<Record<AxisName, T>>
type PerAxisLoopMode = [LoopMode, LoopMode, LoopMode]
type PerAxisEasing = [EasingName, EasingName, EasingName]

export type TransformMotionProps = ThreeElements['group'] & {
  /** 'none' | 'loop' | 'pingpong' */
  loopMode?: LoopMode
  positionVelocity?: Vec3Like
  /** Degrees per second */
  rotationVelocity?: Vec3Like
  scaleVelocity?: Vec3Like
  positionRange?: AxisRangeMap
  /** In degrees */
  rotationRange?: AxisRangeMap
  scaleRange?: AxisRangeMap
  /** Time offset in seconds. Negative = start behind, positive = start ahead. */
  offset?: number
  /** Override loopMode for position (string = all axes, object = per-axis). */
  positionLoopMode?: PerAxisOverride<LoopMode>
  /** Override loopMode for rotation (string = all axes, object = per-axis). */
  rotationLoopMode?: PerAxisOverride<LoopMode>
  /** Override loopMode for scale (string = all axes, object = per-axis). */
  scaleLoopMode?: PerAxisOverride<LoopMode>
  /** Override offset for position in seconds (number = all axes, object = per-axis). */
  positionOffset?: PerAxisOverride<number>
  /** Override offset for rotation in seconds (number = all axes, object = per-axis). */
  rotationOffset?: PerAxisOverride<number>
  /** Override offset for scale in seconds (number = all axes, object = per-axis). */
  scaleOffset?: PerAxisOverride<number>
  /** Starting position in the range as normalized 0-1 progress. 0 = range start, 1 = range end. */
  rangeStart?: number
  /** Override rangeStart for position (number = all axes, object = per-axis). */
  positionRangeStart?: PerAxisOverride<number>
  /** Override rangeStart for rotation (number = all axes, object = per-axis). */
  rotationRangeStart?: PerAxisOverride<number>
  /** Override rangeStart for scale (number = all axes, object = per-axis). */
  scaleRangeStart?: PerAxisOverride<number>
  /** Easing curve applied when a range is active. Defaults to 'linear' (no easing). */
  easing?: EasingName
  /** Override easing for position (string = all axes, object = per-axis). */
  positionEasing?: PerAxisOverride<EasingName>
  /** Override easing for rotation (string = all axes, object = per-axis). */
  rotationEasing?: PerAxisOverride<EasingName>
  /** Override easing for scale (string = all axes, object = per-axis). */
  scaleEasing?: PerAxisOverride<EasingName>
  /** When true, the track is unregistered from the animation loop (zero CPU cost). */
  paused?: boolean
}

type MotionTrackConfig = {
  positionLoopMode: PerAxisLoopMode
  rotationLoopMode: PerAxisLoopMode
  scaleLoopMode: PerAxisLoopMode
  positionEasing: PerAxisEasing
  rotationEasing: PerAxisEasing
  scaleEasing: PerAxisEasing
  positionVelocity: Vec3
  rotationVelocity: Vec3
  scaleVelocity: Vec3
  positionRange?: AxisRangeMap
  rotationRange?: AxisRangeMap
  scaleRange?: AxisRangeMap
}

type MotionTrackState = {
  positionDirection: Vec3
  rotationDirection: Vec3
  scaleDirection: Vec3
  positionProgress: Vec3
  rotationProgress: Vec3
  scaleProgress: Vec3
}

type MotionTrack = {
  ref: MutableRefObject<THREE.Group | null>
  configRef: MutableRefObject<MotionTrackConfig>
  state: MotionTrackState
}

type MotionRegistry = {
  register(track: MotionTrack): () => void
}

const ZERO_VEC3: Vec3 = [0, 0, 0]
const DEG2RAD = Math.PI / 180

function normalizeVec3Like(input?: Vec3Like): Vec3 {
  if (!input) return [...ZERO_VEC3]
  if (Array.isArray(input)) return [input[0] ?? 0, input[1] ?? 0, input[2] ?? 0]
  return [input.x ?? 0, input.y ?? 0, input.z ?? 0]
}

function normalizeRange(range: AxisRange): AxisRange {
  const min = Math.min(range[0], range[1])
  const max = Math.max(range[0], range[1])
  return [min, max]
}

function applyLoop(current: number, range: AxisRange): number {
  const [min, max] = normalizeRange(range)
  const span = max - min
  if (span <= 0) return min

  let wrapped = current
  while (wrapped > max) wrapped -= span
  while (wrapped < min) wrapped += span
  return wrapped
}

function applyPingPong(current: number, direction: number, range: AxisRange): { value: number; direction: number } {
  const [min, max] = normalizeRange(range)
  if (max <= min) return { value: min, direction }

  let value = current
  let dir = direction

  // Handle overshoot robustly even on large frame deltas.
  while (value > max || value < min) {
    if (value > max) {
      value = max - (value - max)
      dir = -Math.abs(dir)
    } else if (value < min) {
      value = min + (min - value)
      dir = Math.abs(dir)
    }
  }

  return { value, direction: dir }
}

type XYZLike = {
  x: number
  y: number
  z: number
}

function hasAxisRange(range: AxisRangeMap | undefined): boolean {
  return Boolean(range?.x || range?.y || range?.z)
}

function rangeMapToRadians(range?: AxisRangeMap): AxisRangeMap | undefined {
  if (!range) return undefined
  const result: AxisRangeMap = {}
  for (const axis of TRANSFORM_MOTION_AXES) {
    const ar = range[axis]
    if (ar) result[axis] = [ar[0] * DEG2RAD, ar[1] * DEG2RAD]
  }
  return result
}

function resolvePerAxisLoopMode(global: LoopMode, override?: PerAxisOverride<LoopMode>): PerAxisLoopMode {
  if (!override) return [global, global, global]
  if (typeof override === 'string') return [override, override, override]
  return TRANSFORM_MOTION_AXES.map(a => override[a] ?? global) as PerAxisLoopMode
}

function resolvePerAxisEasing(global: EasingName, override?: PerAxisOverride<EasingName>): PerAxisEasing {
  if (!override) return [global, global, global]
  if (typeof override === 'string') return [override, override, override]
  return TRANSFORM_MOTION_AXES.map(a => override[a] ?? global) as PerAxisEasing
}

function resolvePerAxisOffset(global: number, override?: PerAxisOverride<number>): Vec3 {
  if (override === undefined) return [global, global, global]
  if (typeof override === 'number') return [override, override, override]
  return TRANSFORM_MOTION_AXES.map(a => override[a] ?? global) as Vec3
}

function wrapProgress(t: number): number {
  let v = t % 1
  if (v < 0) v += 1
  return v
}

function bounceProgress(t: number, direction: number): { t: number; direction: number } {
  let v = t
  let dir = direction
  while (v > 1 || v < 0) {
    if (v > 1) {
      v = 2 - v
      dir = -Math.abs(dir)
    } else if (v < 0) {
      v = -v
      dir = Math.abs(dir)
    }
  }
  return { t: v, direction: dir }
}

function updateVector(
  vector: XYZLike,
  velocity: Vec3,
  range: AxisRangeMap | undefined,
  direction: Vec3,
  loopModes: PerAxisLoopMode,
  easings: PerAxisEasing,
  progress: Vec3,
  delta: number,
) {
  TRANSFORM_MOTION_AXES.forEach((axis, index) => {
    const speed = velocity[index] ?? 0
    if (speed === 0) return

    const lm = loopModes[index]
    const easing = easings[index]
    const axisRange = range?.[axis]

    if (easing !== 'linear' && axisRange && lm !== 'none') {
      const [min, max] = normalizeRange(axisRange)
      const span = max - min
      if (span <= 0) return

      const dt = (Math.abs(speed) / span) * delta
      const dirValue = direction[index] ?? 1
      let t = progress[index] + dt * dirValue

      if (lm === 'loop') {
        t = wrapProgress(t)
      } else {
        const result = bounceProgress(t, dirValue)
        t = result.t
        direction[index] = result.direction
      }

      progress[index] = t
      vector[axis] = min + applyEasing(t, easing) * span
      return
    }

    const directionValue = direction[index] ?? 1
    const step = speed * directionValue * delta
    const next = vector[axis] + step

    if (!axisRange || lm === 'none') {
      vector[axis] = next
      return
    }

    if (lm === 'loop') {
      vector[axis] = applyLoop(next, axisRange)
      return
    }

    const pingPongResult = applyPingPong(next, directionValue, axisRange)
    direction[index] = pingPongResult.direction
    vector[axis] = pingPongResult.value
  })
}

const MotionRegistryContext = createContext<MotionRegistry | null>(null)

export function MotionSystemProvider({ children }: { children: ReactNode }) {
  const tracksRef = useRef<Set<MotionTrack>>(new Set())

  const registry = useMemo<MotionRegistry>(() => ({
    register(track) {
      tracksRef.current.add(track)
      return () => {
        tracksRef.current.delete(track)
      }
    },
  }), [])

  useFrame((_, delta) => {
    tracksRef.current.forEach((track) => {
      const object = track.ref.current
      if (!object) return

      const config = track.configRef.current
      updateVector(
        object.position,
        config.positionVelocity,
        config.positionRange,
        track.state.positionDirection,
        config.positionLoopMode,
        config.positionEasing,
        track.state.positionProgress,
        delta,
      )
      updateVector(
        object.rotation,
        config.rotationVelocity,
        config.rotationRange,
        track.state.rotationDirection,
        config.rotationLoopMode,
        config.rotationEasing,
        track.state.rotationProgress,
        delta,
      )
      updateVector(
        object.scale,
        config.scaleVelocity,
        config.scaleRange,
        track.state.scaleDirection,
        config.scaleLoopMode,
        config.scaleEasing,
        track.state.scaleProgress,
        delta,
      )
    })
  })

  return (
    <MotionRegistryContext.Provider value={registry}>
      {children}
    </MotionRegistryContext.Provider>
  )
}

export function TransformMotion({
  children,
  loopMode,
  positionVelocity,
  rotationVelocity,
  scaleVelocity,
  positionRange,
  rotationRange,
  scaleRange,
  offset,
  positionLoopMode,
  rotationLoopMode,
  scaleLoopMode,
  positionOffset,
  rotationOffset,
  scaleOffset,
  rangeStart,
  positionRangeStart,
  rotationRangeStart,
  scaleRangeStart,
  easing,
  positionEasing,
  rotationEasing,
  scaleEasing,
  paused,
  ...groupProps
}: TransformMotionProps) {
  const registry = useContext(MotionRegistryContext)
  if (!registry) {
    throw new Error('TransformMotion must be used inside MotionSystemProvider')
  }

  const effectiveLoopMode: LoopMode = loopMode ?? (hasAxisRange(positionRange) ? 'loop' : 'none')
  const ref = useRef<THREE.Group | null>(null)
  const effectiveEasing: EasingName = easing ?? 'linear'
  const computedConfig = useMemo<MotionTrackConfig>(() => ({
    positionLoopMode: resolvePerAxisLoopMode(effectiveLoopMode, positionLoopMode),
    rotationLoopMode: resolvePerAxisLoopMode(effectiveLoopMode, rotationLoopMode),
    scaleLoopMode: resolvePerAxisLoopMode(effectiveLoopMode, scaleLoopMode),
    positionEasing: resolvePerAxisEasing(effectiveEasing, positionEasing),
    rotationEasing: resolvePerAxisEasing(effectiveEasing, rotationEasing),
    scaleEasing: resolvePerAxisEasing(effectiveEasing, scaleEasing),
    positionVelocity: normalizeVec3Like(positionVelocity),
    rotationVelocity: normalizeVec3Like(rotationVelocity).map(v => v * DEG2RAD) as Vec3,
    scaleVelocity: normalizeVec3Like(scaleVelocity),
    positionRange,
    rotationRange: rangeMapToRadians(rotationRange),
    scaleRange,
  }), [
    effectiveLoopMode,
    effectiveEasing,
    positionVelocity,
    rotationVelocity,
    scaleVelocity,
    positionRange,
    rotationRange,
    scaleRange,
    positionLoopMode,
    rotationLoopMode,
    scaleLoopMode,
    positionEasing,
    rotationEasing,
    scaleEasing,
  ])
  const configRef = useRef<MotionTrackConfig>(computedConfig)
  const stateRef = useRef<MotionTrackState>({
    positionDirection: [1, 1, 1],
    rotationDirection: [1, 1, 1],
    scaleDirection: [1, 1, 1],
    positionProgress: [0, 0, 0],
    rotationProgress: [0, 0, 0],
    scaleProgress: [0, 0, 0],
  })

  useEffect(() => {
    configRef.current = computedConfig
  }, [computedConfig])

  useEffect(() => {
    if (paused) return
    return registry.register({
      ref,
      configRef,
      state: stateRef.current,
    })
  }, [registry, paused])

  useEffect(() => {
    const object = ref.current
    if (!object) return
    const config = configRef.current
    const state = stateRef.current

    const globalRangeStart = rangeStart ?? 0
    const posStarts = resolvePerAxisOffset(globalRangeStart, positionRangeStart)
    const rotStarts = resolvePerAxisOffset(globalRangeStart, rotationRangeStart)
    const sclStarts = resolvePerAxisOffset(globalRangeStart, scaleRangeStart)

    const globalOffset = offset ?? 0
    const posOffsets = resolvePerAxisOffset(globalOffset, positionOffset)
    const rotOffsets = resolvePerAxisOffset(globalOffset, rotationOffset)
    const sclOffsets = resolvePerAxisOffset(globalOffset, scaleOffset)

    const hasAnyStart = posStarts.some(v => v !== 0) || rotStarts.some(v => v !== 0) || sclStarts.some(v => v !== 0)
    const hasAnyOffset = posOffsets.some(v => v !== 0) || rotOffsets.some(v => v !== 0) || sclOffsets.some(v => v !== 0)
    if (!hasAnyStart && !hasAnyOffset) return

    TRANSFORM_MOTION_AXES.forEach((axis, i) => {
      const initAxis = (
        target: XYZLike,
        velocity: Vec3,
        range: AxisRangeMap | undefined,
        lm: LoopMode,
        dirArr: Vec3,
        easingName: EasingName,
        progressArr: Vec3,
        axisRangeStart: number,
        axisOffset: number,
      ) => {
        if (axisRangeStart === 0 && axisOffset === 0) return
        const axisRange = range?.[axis]

        if (easingName !== 'linear' && axisRange && lm !== 'none') {
          const [min, max] = normalizeRange(axisRange)
          const span = max - min
          if (span <= 0) return

          let t = Math.max(0, Math.min(1, axisRangeStart))
          if (axisOffset !== 0) {
            t += (Math.abs(velocity[i]) / span) * axisOffset
          }
          if (lm === 'loop') {
            t = wrapProgress(t)
          } else {
            const result = bounceProgress(t, dirArr[i])
            t = result.t
            dirArr[i] = result.direction
          }
          progressArr[i] = t
          target[axis] = min + applyEasing(t, easingName) * span
          return
        }

        if (axisRange && lm !== 'none' && axisRangeStart !== 0) {
          const [min, max] = normalizeRange(axisRange)
          const span = max - min
          target[axis] = min + Math.max(0, Math.min(1, axisRangeStart)) * span
        }

        if (axisOffset !== 0) {
          target[axis] += velocity[i] * axisOffset
        }

        if (!axisRange || lm === 'none') return
        if (lm === 'loop') {
          target[axis] = applyLoop(target[axis], axisRange)
        } else {
          const r = applyPingPong(target[axis], dirArr[i], axisRange)
          target[axis] = r.value
          dirArr[i] = r.direction
        }
      }

      initAxis(object.position, config.positionVelocity, config.positionRange, config.positionLoopMode[i], state.positionDirection, config.positionEasing[i], state.positionProgress, posStarts[i], posOffsets[i])
      initAxis(object.rotation, config.rotationVelocity, config.rotationRange, config.rotationLoopMode[i], state.rotationDirection, config.rotationEasing[i], state.rotationProgress, rotStarts[i], rotOffsets[i])
      initAxis(object.scale, config.scaleVelocity, config.scaleRange, config.scaleLoopMode[i], state.scaleDirection, config.scaleEasing[i], state.scaleProgress, sclStarts[i], sclOffsets[i])
    })
  }, [])

  return (
    <group {...groupProps}>
      <group ref={ref}>{children}</group>
    </group>
  )
}
