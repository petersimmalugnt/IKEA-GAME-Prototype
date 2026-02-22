import type { Vec3 } from '@/settings/GameSettings'

export type Simplify<T> = { [K in keyof T]: T[K] } & {}

export type ElementTransformProps = {
  position?: Vec3
  rotation?: Vec3
  scale?: Vec3
}

export type ElementRenderProps = {
  name?: string
  visible?: boolean
  castShadow?: boolean
  receiveShadow?: boolean
  renderOrder?: number
  frustumCulled?: boolean
}
