import { forwardRef, useMemo, type ForwardRefExoticComponent, type RefAttributes } from 'react'
import type { MaterialColorIndex, Vec3 } from '@/settings/GameSettings'
import type { PositionTargetHandle } from '@/scene/PositionTargetHandle'
import { toRadians } from '@/scene/SceneHelpers'
import { Bridge, type BridgeProps } from '@/assets/models/Bridge'
import { getAlignOffset, type Align3 } from '@/geometry/align'
import type { ElementRenderProps, ElementTransformProps, Simplify } from './ElementBaseProps'
import type { PhysicsProps } from '@/physics/PhysicsWrapper'

export const BRIDGE_BLOCK_PLANES = ['x', 'y', 'z'] as const
export type BridgeBlockPlane = (typeof BRIDGE_BLOCK_PLANES)[number]

const BRIDGE_BLOCK_BASE_SIZE: Vec3 = [0.4, 0.2, 0.2]

export function resolveBridgeBlockSize(plane: BridgeBlockPlane): Vec3 {
  if (plane === 'y') return [BRIDGE_BLOCK_BASE_SIZE[1], BRIDGE_BLOCK_BASE_SIZE[0], BRIDGE_BLOCK_BASE_SIZE[2]]
  if (plane === 'z') return [BRIDGE_BLOCK_BASE_SIZE[1], BRIDGE_BLOCK_BASE_SIZE[2], BRIDGE_BLOCK_BASE_SIZE[0]]
  return [...BRIDGE_BLOCK_BASE_SIZE]
}

function resolveBridgePlaneRotation(plane: BridgeBlockPlane): Vec3 {
  if (plane === 'y') return [0, 0, 90]
  if (plane === 'z') return [0, -90, 0]
  return [0, 0, 0]
}

function resolveBridgeCenterCorrection(plane: BridgeBlockPlane): Vec3 {
  // Bridge geometry origin is not centered on Y (minY=0, maxY=0.2).
  // Apply a plane-aware correction so align math behaves like centered block primitives.
  if (plane === 'y') return [0.1, 0, 0]
  return [0, -0.1, 0]
}

export type BridgeBlockElementProps = Simplify<ElementTransformProps & ElementRenderProps & PhysicsProps & {
  plane?: BridgeBlockPlane
  align?: Align3
  color?: MaterialColorIndex
  singleTone?: boolean
  hidden?: boolean
  bridgeProps?: Omit<BridgeProps, 'materialColor0' | 'materialHidden0' | 'singleTone' | 'physics'>
}>

export type BridgeBlockElementComponent = ForwardRefExoticComponent<
  BridgeBlockElementProps & RefAttributes<PositionTargetHandle>
>

export const BridgeBlockElement: BridgeBlockElementComponent = forwardRef<PositionTargetHandle, BridgeBlockElementProps>(function BridgeBlockElement({
  plane = 'x',
  align,
  color = 1,
  singleTone = true,
  hidden = false,
  visible = true,
  position,
  rotation = [0, 0, 0],
  scale,
  physics,
  mass,
  friction,
  restitution,
  lockRotations,
  entityId,
  contagionCarrier,
  contagionInfectable,
  contagionColor,
  linearVelocity,
  angularVelocity,
  linearDamping,
  angularDamping,
  bridgeProps,
}, _ref) {
  const size = useMemo(() => resolveBridgeBlockSize(plane), [plane])
  const finalAlign = useMemo(() => ({ y: 0, ...align }), [align])
  const anchorOffset = useMemo(() => getAlignOffset(size, finalAlign), [size, finalAlign])
  const centerCorrection = useMemo(() => resolveBridgeCenterCorrection(plane), [plane])
  const bridgeOffset = useMemo<Vec3>(
    () => [
      anchorOffset[0] + centerCorrection[0],
      anchorOffset[1] + centerCorrection[1],
      anchorOffset[2] + centerCorrection[2],
    ],
    [anchorOffset, centerCorrection],
  )
  const planeRotation = useMemo(() => toRadians(resolveBridgePlaneRotation(plane)), [plane])
  const worldRotation = useMemo(() => toRadians(rotation), [rotation])

  return (
    <group
      {...(position !== undefined ? { position } : {})}
      {...(scale !== undefined ? { scale } : {})}
      rotation={worldRotation}
    >
      <Bridge
        {...bridgeProps}
        materialColor0={color}
        materialHidden0={hidden || !visible}
        singleTone={singleTone}
        physics={physics}
        mass={mass}
        friction={friction}
        restitution={restitution}
        lockRotations={lockRotations}
        entityId={entityId}
        contagionCarrier={contagionCarrier}
        contagionInfectable={contagionInfectable}
        contagionColor={contagionColor}
        {...(linearVelocity !== undefined ? { linearVelocity } : {})}
        {...(angularVelocity !== undefined ? { angularVelocity } : {})}
        {...(linearDamping !== undefined ? { linearDamping } : {})}
        {...(angularDamping !== undefined ? { angularDamping } : {})}
        position={bridgeOffset}
        rotation={planeRotation}
      />
    </group>
  )
})
