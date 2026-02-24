import { useEffect, useRef, type ReactNode } from 'react'
import {
  CuboidCollider,
  CylinderCollider,
  BallCollider,
  type CollisionEnterPayload,
  type IntersectionEnterPayload,
  type RigidBodyProps,
  type RapierCollider,
} from '@react-three/rapier'
import type { Vec3 } from '@/settings/GameSettings'
import { GameRigidBody } from '../physics/GameRigidBody'
import type { GameRigidBodyContagion } from '../physics/GameRigidBody'
import type { GamePhysicsBodyType } from '../physics/physicsTypes'
import type { ContagionProps } from '@/gameplay/contagionProps'

type PhysicsBodyType = GamePhysicsBodyType
export type { ContagionProps } from '@/gameplay/contagionProps'

export type PhysicsProps = ContagionProps & {
  physics?: PhysicsBodyType
  mass?: number
  friction?: number
  lockRotations?: boolean
  position?: Vec3
  rotation?: Vec3
  linearVelocity?: Vec3
  angularVelocity?: Vec3
  linearDamping?: number
  angularDamping?: number
}

type ColliderType = 'cuboid' | 'cylinder' | 'ball'

type PhysicsWrapperProps = Omit<
  RigidBodyProps,
  'type' | 'position' | 'rotation' | 'mass' | 'friction' | 'linearVelocity' | 'angularVelocity' | 'linearDamping' | 'angularDamping'
> & ContagionProps & {
  physics?: PhysicsBodyType
  colliderType?: ColliderType
  colliderArgs: [number] | [number, number] | [number, number, number]
  syncColliderShape?: boolean
  colliderPosition?: Vec3
  position?: Vec3
  rotation?: Vec3
  linearVelocity?: Vec3
  angularVelocity?: Vec3
  linearDamping?: number
  angularDamping?: number
  mass?: number
  friction?: number
  lockRotations?: boolean
  onCollisionActivated?: (payload: CollisionEnterPayload | IntersectionEnterPayload) => void
  children: ReactNode
}

export function PhysicsWrapper({
  physics,
  colliderType = 'cuboid',
  colliderArgs,
  syncColliderShape = false,
  colliderPosition,
  position,
  rotation,
  linearVelocity,
  angularVelocity,
  linearDamping,
  angularDamping,
  mass,
  friction,
  lockRotations,
  entityId,
  contagionCarrier,
  contagionInfectable,
  contagionColor,
  onCollisionActivated,
  children,
  ...rigidBodyProps
}: PhysicsWrapperProps) {
  if (!physics) return <>{children}</>
  const colliderSensor = Boolean(rigidBodyProps.sensor)

  // We always provide explicit collider components in this wrapper.
  // Disable auto-collider generation to avoid duplicate colliders.
  const rbProps: Omit<RigidBodyProps, 'type'> = { colliders: false, ...rigidBodyProps }
  if (position !== undefined) rbProps.position = position
  if (rotation !== undefined) rbProps.rotation = rotation
  if (linearVelocity !== undefined) rbProps.linearVelocity = linearVelocity
  if (angularVelocity !== undefined) rbProps.angularVelocity = angularVelocity
  if (linearDamping !== undefined) rbProps.linearDamping = linearDamping
  if (angularDamping !== undefined) rbProps.angularDamping = angularDamping
  if (mass !== undefined) rbProps.mass = mass
  if (friction !== undefined) rbProps.friction = friction
  if (lockRotations) rbProps.lockRotations = true

  const colliderRef = useRef<RapierCollider | null>(null)
  const arg0 = colliderArgs[0]
  const arg1 = (colliderArgs as [number, number] | [number, number, number])[1]
  const arg2 = (colliderArgs as [number, number, number])[2]

  useEffect(() => {
    if (!syncColliderShape) return
    const collider = colliderRef.current
    if (!collider) return

    if (colliderType === 'cuboid') {
      collider.setHalfExtents({
        x: arg0 ?? 0.5,
        y: arg1 ?? 0.5,
        z: arg2 ?? 0.5,
      })
      return
    }

    if (colliderType === 'ball') {
      collider.setRadius(arg0 ?? 0.5)
      return
    }

    collider.setHalfHeight(arg0 ?? 0.5)
    collider.setRadius(arg1 ?? 0.5)
  }, [syncColliderShape, colliderType, arg0, arg1, arg2])

  const collider = (() => {
    if (colliderType === 'cylinder') {
      return (
        <CylinderCollider
          ref={colliderRef}
          args={colliderArgs as [number, number]}
          position={colliderPosition}
          sensor={colliderSensor}
        />
      )
    }
    if (colliderType === 'ball') {
      return <BallCollider ref={colliderRef} args={colliderArgs as [number]} position={colliderPosition} sensor={colliderSensor} />
    }
    return (
      <CuboidCollider
        ref={colliderRef}
        args={colliderArgs as [number, number, number]}
        position={colliderPosition}
        sensor={colliderSensor}
      />
    )
  })()

  const handleCollisionActivated = (payload: CollisionEnterPayload | IntersectionEnterPayload) => {
    onCollisionActivated?.(payload)
  }

  const contagion: GameRigidBodyContagion = {
    entityId,
    carrier: contagionCarrier === true,
    infectable: contagionInfectable !== false,
    colorIndex: contagionColor ?? 0,
  }

  return (
    <GameRigidBody
      {...rbProps}
      type={physics}
      contagion={contagion}
      onCollisionActivated={handleCollisionActivated}
    >
      {collider}
      {children}
    </GameRigidBody>
  )
}
