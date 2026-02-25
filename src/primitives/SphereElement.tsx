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

export type SphereElementProps = Simplify<ElementTransformProps & ElementRenderProps & PhysicsProps & {
  radius?: number
  segments?: number
  color?: MaterialColorIndex
  singleTone?: boolean
  flatShading?: boolean
  hidden?: boolean
  align?: Align3
}>

export const SphereElement = forwardRef<PositionTargetHandle, SphereElementProps>(function SphereElement({
  radius = 0.5,
  segments = 32,
  color = 0,
  singleTone = true,
  flatShading = false,
  hidden = false,
  visible = true,
  castShadow = true,
  receiveShadow = true,
  align,
  scale,
  physics,
  mass,
  friction,
  restitution,
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
  const surfaceId = useSurfaceId()
  const rotationRadians = useMemo(() => toRadians(rotation), [rotation])
  const anchorOffset = useMemo<Vec3>(
    () => getAlignOffset([radius * 2, radius * 2, radius * 2], align),
    [radius, align?.x, align?.y, align?.z],
  )
  const colliderArgs = useMemo<[number]>(() => [radius], [radius])
  const contagionColorOverride = useContagionColorOverride(entityId)
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
      <sphereGeometry args={[radius, segments, segments]} />
      <C4DMaterial color={resolvedColor} singleTone={singleTone} flatShading={flatShading} />
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
      colliderType="ball"
      colliderArgs={colliderArgs}
      colliderPosition={anchorOffset}
      position={position}
      rotation={rotationRadians}
      mass={mass}
      friction={friction}
      restitution={restitution}
      lockRotations={lockRotations}
      linearVelocity={linearVelocity}
      angularVelocity={angularVelocity}
      linearDamping={linearDamping}
      angularDamping={angularDamping}
      entityId={entityId}
      contagionCarrier={contagionCarrier}
      contagionInfectable={contagionInfectable}
      contagionColor={contagionColor ?? resolvedColor}
    >
      {mesh}
    </PhysicsWrapper>
  )
})
