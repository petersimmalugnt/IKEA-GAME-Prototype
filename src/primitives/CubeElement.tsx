import * as THREE from 'three'
import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react'
import { C4DMaterial } from '@/render/Materials'
import type { MaterialColorIndex, Vec3 } from '@/settings/GameSettings'
import type { PositionTargetHandle } from '@/scene/PositionTargetHandle'
import { toRadians, useSurfaceId } from '@/scene/SceneHelpers'
import { PhysicsWrapper, type PhysicsProps } from '@/physics/PhysicsWrapper'
import { getAlignOffset, type Align3 } from '@/geometry/align'
import { useContagionColorOverride } from '@/gameplay/gameplayStore'
import type { ElementRenderProps, ElementTransformProps, Simplify } from './ElementBaseProps'

export type CubeElementProps = Simplify<ElementTransformProps & ElementRenderProps & PhysicsProps & {
  size?: Vec3
  color?: MaterialColorIndex
  singleTone?: boolean
  hidden?: boolean
  align?: Align3
}>

let autoCubeEntityIdCounter = 0

function createAutoCubeEntityId(): string {
  autoCubeEntityIdCounter += 1
  return `auto-cube-${autoCubeEntityIdCounter}`
}

export const CubeElement = forwardRef<PositionTargetHandle, CubeElementProps>(function CubeElement({
  size = [1, 1, 1],
  color = 0,
  singleTone = false,
  hidden = false,
  visible = true,
  castShadow = true,
  receiveShadow = true,
  align,
  scale,
  physics,
  mass,
  friction,
  lockRotations,
  linearVelocity,
  angularVelocity,
  linearDamping,
  angularDamping,
  entityId,
  contagionCarrier,
  contagionInfectable,
  contagionColor,
  position,
  rotation = [0, 0, 0],
  name,
  renderOrder,
  frustumCulled,
}, ref) {
  const meshRef = useRef<THREE.Mesh | null>(null)
  const worldPos = useMemo(() => new THREE.Vector3(), [])
  const autoEntityIdRef = useRef<string>(createAutoCubeEntityId())
  const surfaceId = useSurfaceId()
  const rotationRadians = useMemo(() => toRadians(rotation), [rotation])
  const resolvedEntityId = typeof entityId === 'string' && entityId.trim().length > 0
    ? entityId.trim()
    : autoEntityIdRef.current
  const anchorOffset = useMemo<Vec3>(
    () => getAlignOffset(size, align),
    [size, align?.x, align?.y, align?.z],
  )
  const colliderArgs = useMemo<[number, number, number]>(
    () => [size[0] / 2, size[1] / 2, size[2] / 2],
    [size],
  )
  const contagionColorOverride = useContagionColorOverride(resolvedEntityId)
  const resolvedColor = contagionColorOverride ?? color

  useImperativeHandle(ref, () => ({
    getPosition: () => {
      if (!meshRef.current) return undefined
      const source = meshRef.current.parent ?? meshRef.current
      source.getWorldPosition(worldPos)
      return { x: worldPos.x, y: worldPos.y, z: worldPos.z }
    },
  }), [worldPos])

  const mesh = (
    <mesh
      ref={meshRef}
      {...(name !== undefined ? { name } : {})}
      {...(renderOrder !== undefined ? { renderOrder } : {})}
      {...(frustumCulled !== undefined ? { frustumCulled } : {})}
      position={anchorOffset}
      {...(physics && scale !== undefined ? { scale } : {})}
      visible={visible && !hidden}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
      userData={{ surfaceId }}
    >
      <boxGeometry args={size} />
      <C4DMaterial color={resolvedColor} singleTone={singleTone} />
    </mesh>
  )

  if (!physics) {
    return (
      <group position={position} rotation={rotationRadians} {...(scale !== undefined ? { scale } : {})}>
        {mesh}
      </group>
    )
  }

  return (
    <PhysicsWrapper
      physics={physics}
      colliderType="cuboid"
      colliderArgs={colliderArgs}
      colliderPosition={anchorOffset}
      position={position}
      rotation={rotationRadians}
      linearVelocity={linearVelocity}
      angularVelocity={angularVelocity}
      linearDamping={linearDamping}
      angularDamping={angularDamping}
      mass={mass}
      friction={friction}
      lockRotations={lockRotations}
      entityId={resolvedEntityId}
      contagionCarrier={contagionCarrier}
      contagionInfectable={contagionInfectable}
      contagionColor={contagionColor ?? resolvedColor}
    >
      {mesh}
    </PhysicsWrapper>
  )
})
