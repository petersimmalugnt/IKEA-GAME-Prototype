export const ACCELERATION_CURVE_NAMES = [
  'linear',
  'power_1_25',
  'power_1_5',
  'power_2',
  'exponential',
] as const

export type AccelerationCurveName = (typeof ACCELERATION_CURVE_NAMES)[number]

export function resolveAccelerationMultiplier(
  acceleration: number,
  curve: AccelerationCurveName,
  timeSeconds: number,
): number {
  if (acceleration === 0 || timeSeconds <= 0) return 1

  switch (curve) {
    case 'power_1_25':
      return Math.max(0, 1 + acceleration * Math.pow(timeSeconds, 1.25))
    case 'power_1_5':
      return Math.max(0, 1 + acceleration * Math.pow(timeSeconds, 1.5))
    case 'power_2':
      return Math.max(0, 1 + acceleration * Math.pow(timeSeconds, 2))
    case 'exponential':
      return Math.exp(acceleration * timeSeconds)
    case 'linear':
    default:
      return Math.max(0, 1 + acceleration * timeSeconds)
  }
}
