import type { MaterialColorIndex } from '@/settings/GameSettings'

export type ContagionProps = {
  /** Optional stable id for contagion tracking. Auto-generated when omitted. */
  entityId?: string
  /** Starts the body as an active contagion carrier. */
  contagionCarrier?: boolean
  /** If false, this body cannot be overwritten by incoming contagion. */
  contagionInfectable?: boolean
  /** Initial contagion color for lineage/source; defaults to element color. */
  contagionColor?: MaterialColorIndex
}
