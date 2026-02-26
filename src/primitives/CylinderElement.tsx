import * as THREE from 'three'
import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react'
import { ConvexHullCollider, type RigidBodyProps } from '@react-three/rapier'
import { C4DMaterial } from '@/render/Materials'
import type { MaterialColorIndex, Vec3 } from '@/settings/GameSettings'
import type { PositionTargetHandle } from '@/scene/PositionTargetHandle'
import { toRadians, useSurfaceId } from '@/scene/SceneHelpers'
import { GameRigidBody } from '../physics/GameRigidBody'
import type { PhysicsProps } from '@/physics/PhysicsWrapper'
import { getAlignOffset, type Align3 } from '@/geometry/align'
import { useContagionColorOverride } from '@/gameplay/gameplayStore'
import type { ElementRenderProps, ElementTransformProps, Simplify } from './ElementBaseProps'

export type CylinderElementProps = Simplify<ElementTransformProps & ElementRenderProps & PhysicsProps & {
  radius?: number
  height?: number
  segments?: number
  colliderSegments?: number
  color?: MaterialColorIndex
  singleTone?: boolean
  hidden?: boolean
  align?: Align3
}>

export const CylinderElement = forwardRef<PositionTargetHandle, CylinderElementProps>(function CylinderElement({
  radius = 0.5,
  height = 1,
  segments = 32,
  colliderSegments = 8,
  color = 0,
  singleTone = true,
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
  collisionSound,
  lockRotations,
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
  const colliderRestitutionProps = Number.isFinite(restitution) ? { restitution } : {}
  const anchorOffset = useMemo<Vec3>(
    () => getAlignOffset([radius * 2, height, radius * 2], align),
    [radius, height, align?.x, align?.y, align?.z],
  )
  const contagionColorOverride = useContagionColorOverride(entityId)
  const resolvedColor = contagionColorOverride ?? color

  // Generera cylinderformad konvex hull: topp- och bottenring med N sidor
  const hullVertices = useMemo(() => {
    const verts: number[] = []
    const halfH = height / 2
    for (let i = 0; i < colliderSegments; i++) {
      const angle = (i / colliderSegments) * Math.PI * 2
      const x = Math.cos(angle) * radius
      const z = Math.sin(angle) * radius
      verts.push(x, halfH, z)
      verts.push(x, -halfH, z)
    }
    return new Float32Array(verts)
  }, [radius, height, colliderSegments])

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
      <cylinderGeometry args={[radius, radius, height, segments]} />
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

  const rbProps: Omit<RigidBodyProps, 'type'> = {}
  if (position !== undefined) rbProps.position = position
  if (rotation !== undefined) rbProps.rotation = rotationRadians
  if (mass !== undefined) rbProps.mass = mass
  if (friction !== undefined) rbProps.friction = friction
  if (lockRotations) rbProps.lockRotations = true

  return (
    <GameRigidBody
      {...rbProps}
      type={physics}
      colliders={false}
      collisionSound={collisionSound}
      contagion={{
        entityId,
        carrier: contagionCarrier === true,
        infectable: contagionInfectable !== false,
        colorIndex: contagionColor ?? resolvedColor,
      }}
    >
      <ConvexHullCollider args={[hullVertices]} position={anchorOffset} {...colliderRestitutionProps} />
      {mesh}
    </GameRigidBody>
  )
})
