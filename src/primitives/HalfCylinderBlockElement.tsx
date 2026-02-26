import { forwardRef, useMemo, type ForwardRefExoticComponent, type RefAttributes } from 'react'
import type { MaterialColorIndex, Vec3 } from '@/settings/GameSettings'
import type { PositionTargetHandle } from '@/scene/PositionTargetHandle'
import { toRadians } from '@/scene/SceneHelpers'
import type { Align3 } from '@/geometry/align'
import { getAlignOffset } from '@/geometry/align'
import { HalfCylinder, type HalfCylinderProps } from '@/assets/models/HalfCylinder'
import { HalfCylinder_realDimensions } from '@/assets/models/HalfCylinder_realDimensions'
import type { ElementRenderProps, ElementTransformProps, Simplify } from './ElementBaseProps'
import type { PhysicsProps } from '@/physics/PhysicsWrapper'

export const HALF_CYLINDER_BLOCK_SIZE_PRESETS = ['md', 'lg'] as const
export const HALF_CYLINDER_BLOCK_PLANES = ['x', 'y', 'z'] as const

export type HalfCylinderBlockSizePreset = (typeof HALF_CYLINDER_BLOCK_SIZE_PRESETS)[number]
export type HalfCylinderBlockPlane = (typeof HALF_CYLINDER_BLOCK_PLANES)[number]

const HALF_CYLINDER_BLOCK_BASE_SIZES: Record<HalfCylinderBlockSizePreset, Vec3> = {
  md: [0.2, 0.1, 0.2],
  lg: [0.282842, 0.141421, 0.2],
}

function resolveHalfCylinderPlaneRotation(plane: HalfCylinderBlockPlane): Vec3 {
  if (plane === 'x') return [0, 0, -90]
  if (plane === 'z') return [90, 0, 0]
  return [0, 0, 0]
}

function resolveHalfCylinderCenterCorrection(
  sizePreset: HalfCylinderBlockSizePreset,
  plane: HalfCylinderBlockPlane,
): Vec3 {
  const [, height] = HALF_CYLINDER_BLOCK_BASE_SIZES[sizePreset]
  if (plane === 'x') return [-height / 2, 0, 0]
  if (plane === 'z') return [0, 0, -height / 2]
  return [0, -height / 2, 0]
}

export function resolveHalfCylinderBlockSize(
  sizePreset: HalfCylinderBlockSizePreset,
  plane: HalfCylinderBlockPlane,
): Vec3 {
  const [width, height, depth] = HALF_CYLINDER_BLOCK_BASE_SIZES[sizePreset]
  if (plane === 'x') return [height, width, depth]
  if (plane === 'z') return [width, depth, height]
  return [width, height, depth]
}

export type HalfCylinderBlockElementProps = Simplify<ElementTransformProps & ElementRenderProps & PhysicsProps & {
  sizePreset?: HalfCylinderBlockSizePreset
  plane?: HalfCylinderBlockPlane
  align?: Align3
  color?: MaterialColorIndex
  singleTone?: boolean
  hidden?: boolean
  halfCylinderProps?: Omit<HalfCylinderProps, 'materialColor0' | 'materialHidden0' | 'singleTone' | 'physics'>
}>

export type HalfCylinderBlockElementComponent = ForwardRefExoticComponent<
  HalfCylinderBlockElementProps & RefAttributes<PositionTargetHandle>
>

export const HalfCylinderBlockElement: HalfCylinderBlockElementComponent = forwardRef<PositionTargetHandle, HalfCylinderBlockElementProps>(function HalfCylinderBlockElement({
  sizePreset = 'md',
  plane = 'y',
  align,
  color = 0,
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
  halfCylinderProps,
}, _ref) {
  const size = useMemo(() => resolveHalfCylinderBlockSize(sizePreset, plane), [sizePreset, plane])
  const finalAlign = useMemo(() => ({ y: 0, ...align }), [align])
  const anchorOffset = useMemo(() => getAlignOffset(size, finalAlign), [size, finalAlign])
  const centerCorrection = useMemo(
    () => resolveHalfCylinderCenterCorrection(sizePreset, plane),
    [sizePreset, plane],
  )
  const modelOffset = useMemo<Vec3>(
    () => [
      anchorOffset[0] + centerCorrection[0],
      anchorOffset[1] + centerCorrection[1],
      anchorOffset[2] + centerCorrection[2],
    ],
    [anchorOffset, centerCorrection],
  )
  const planeRotation = useMemo(() => toRadians(resolveHalfCylinderPlaneRotation(plane)), [plane])
  const worldRotation = useMemo(() => toRadians(rotation), [rotation])
  const ModelComponent = sizePreset === 'lg' ? HalfCylinder_realDimensions : HalfCylinder

  return (
    <group
      {...(position !== undefined ? { position } : {})}
      {...(scale !== undefined ? { scale } : {})}
      rotation={worldRotation}
    >
      <ModelComponent
        {...halfCylinderProps}
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
        position={modelOffset}
        rotation={planeRotation}
      />
    </group>
  )
})
