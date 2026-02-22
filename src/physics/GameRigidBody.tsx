import { Children, cloneElement, isValidElement, useCallback, useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from 'react'
import {
  RigidBody,
  useRapier,
  type CollisionEnterPayload,
  type IntersectionEnterPayload,
  type RapierRigidBody,
  type RigidBodyProps,
} from '@react-three/rapier'
import { SETTINGS } from '@/settings/GameSettings'
import { useGameplayStore, type ContagionCollisionEntity } from '@/gameplay/gameplayStore'
import {
  isCollisionActivatedPhysicsType,
  isNoneActivatedPhysicsType,
  isSolidNoneActivatedPhysicsType,
  resolvePreCollisionBodyType,
  type GamePhysicsBodyType,
} from './physicsTypes'

export type GameRigidBodyContagion = {
  entityId?: string
  carrier?: boolean
  infectable?: boolean
  colorIndex?: number
}

export type GameRigidBodyProps = Omit<RigidBodyProps, 'type' | 'onCollisionEnter' | 'onIntersectionEnter'> & {
  type: GamePhysicsBodyType
  onCollisionEnter?: (payload: CollisionEnterPayload) => void
  onIntersectionEnter?: (payload: IntersectionEnterPayload) => void
  onCollisionActivated?: (payload: CollisionEnterPayload | IntersectionEnterPayload) => void
  contagion?: GameRigidBodyContagion
}

function isColliderElement(node: ReactNode): node is ReactElement<Record<string, unknown>> {
  if (!isValidElement(node)) return false
  const elementType = node.type as { displayName?: string; name?: string }
  const name = elementType.displayName ?? elementType.name ?? ''
  return typeof name === 'string' && name.toLowerCase().includes('collider')
}

let autoContagionEntityCounter = 0

function createAutoContagionEntityId(): string {
  autoContagionEntityCounter += 1
  return `auto-contagion-${autoContagionEntityCounter}`
}

function resolveCollisionEntity(payload: CollisionEnterPayload, key: 'target' | 'other'): ContagionCollisionEntity | null {
  const collisionTarget = payload[key]
  const rawUserData = (collisionTarget.rigidBodyObject?.userData ?? {}) as Record<string, unknown>
  const entityId = typeof rawUserData.entityId === 'string' ? rawUserData.entityId : undefined
  if (!entityId) return null

  const colorIndex = typeof rawUserData.contagionColorIndex === 'number'
    ? rawUserData.contagionColorIndex
    : undefined

  return {
    entityId,
    contagionCarrier: rawUserData.contagionCarrier === true,
    contagionInfectable: rawUserData.contagionInfectable !== false,
    colorIndex,
  }
}

export function GameRigidBody({
  type,
  onCollisionEnter,
  onIntersectionEnter,
  onCollisionActivated,
  contagion,
  sensor: sensorOverride,
  children,
  userData,
  position,
  rotation,
  quaternion,
  scale,
  ...props
}: GameRigidBodyProps) {
  const { rapier } = useRapier()
  const bodyRef = useRef<RapierRigidBody | null>(null)
  const collisionActivated = isCollisionActivatedPhysicsType(type)
  const noneActivated = isNoneActivatedPhysicsType(type)
  const solidNoneActivated = isSolidNoneActivatedPhysicsType(type)
  const [activated, setActivated] = useState(false)
  const activationFiredRef = useRef(false)
  const enqueueContagionPair = useGameplayStore((state) => state.enqueueCollisionPair)
  const contagionEnabled = SETTINGS.gameplay.contagion.enabled
  const autoContagionEntityIdRef = useRef<string>(createAutoContagionEntityId())
  const childArray = useMemo(() => Children.toArray(children), [children])
  const hasExplicitColliderChildren = useMemo(
    () => childArray.some((child) => isColliderElement(child)),
    [childArray],
  )
  const hasBodylessVariant = noneActivated || solidNoneActivated
  const canBodylessArm = hasBodylessVariant && hasExplicitColliderChildren
  const sensorPreCollision = noneActivated && !canBodylessArm
  const mergedUserData = useMemo(() => {
    const baseUserData = (userData && typeof userData === 'object')
      ? userData as Record<string, unknown>
      : {}

    if (!contagion) return baseUserData

    const explicitEntityId = typeof contagion.entityId === 'string'
      ? contagion.entityId.trim()
      : ''
    const baseEntityId = typeof baseUserData.entityId === 'string'
      ? baseUserData.entityId.trim()
      : ''
    const resolvedEntityId = explicitEntityId || baseEntityId || autoContagionEntityIdRef.current

    return {
      ...baseUserData,
      entityId: resolvedEntityId,
      contagionCarrier: contagion.carrier === true,
      contagionInfectable: contagion.infectable !== false,
      contagionColorIndex: contagion.colorIndex ?? 0,
    }
  }, [userData, contagion?.entityId, contagion?.carrier, contagion?.infectable, contagion?.colorIndex])

  useEffect(() => {
    activationFiredRef.current = false
    setActivated(false)
  }, [type])

  const resolvedType = useMemo(
    () => (activated ? 'dynamic' : resolvePreCollisionBodyType(type)),
    [activated, type],
  )

  const setAttachedCollidersSensor = useCallback((isSensor: boolean) => {
    const body = bodyRef.current
    if (!body) return

    const colliderCount = body.numColliders()
    for (let i = 0; i < colliderCount; i += 1) {
      const collider = body.collider(i)
      if (!collider || !collider.isValid()) continue
      if (collider.isSensor() !== isSensor) {
        collider.setSensor(isSensor)
      }
    }
  }, [])

  const applyBodyType = useCallback((nextType: GamePhysicsBodyType | ReturnType<typeof resolvePreCollisionBodyType>) => {
    const body = bodyRef.current
    if (!body) return

    let targetType = rapier.RigidBodyType.Dynamic
    if (nextType === 'fixed') targetType = rapier.RigidBodyType.Fixed
    else if (nextType === 'kinematicPosition') targetType = rapier.RigidBodyType.KinematicPositionBased
    else if (nextType === 'kinematicVelocity') targetType = rapier.RigidBodyType.KinematicVelocityBased

    if (body.bodyType() !== targetType) {
      body.setBodyType(targetType, true)
    }
  }, [rapier.RigidBodyType.Dynamic, rapier.RigidBodyType.Fixed, rapier.RigidBodyType.KinematicPositionBased, rapier.RigidBodyType.KinematicVelocityBased])

  const promoteToDynamicImmediately = useCallback(() => {
    const body = bodyRef.current
    if (!body) return
    applyBodyType('dynamic')
    body.wakeUp()
  }, [applyBodyType])

  useEffect(() => {
    if (collisionActivated && activationFiredRef.current && !activated) return
    applyBodyType(resolvedType)
  }, [resolvedType, applyBodyType, collisionActivated, activated])

  useEffect(() => {
    if (collisionActivated && activationFiredRef.current && !activated) return
    if (!sensorPreCollision) return
    setAttachedCollidersSensor(!activated)
  }, [sensorPreCollision, activated, setAttachedCollidersSensor, collisionActivated])

  const activate = useCallback((payload: CollisionEnterPayload | IntersectionEnterPayload) => {
    if (!collisionActivated || activationFiredRef.current) return
    activationFiredRef.current = true
    if (sensorPreCollision) {
      // Switch colliders out of sensor mode immediately on first trigger.
      setAttachedCollidersSensor(false)
    }
    // Avoid a frame of lag where body type/sensor state can desync under heavy motion.
    promoteToDynamicImmediately()
    setActivated(true)
    onCollisionActivated?.(payload)
  }, [collisionActivated, onCollisionActivated, sensorPreCollision, setAttachedCollidersSensor, promoteToDynamicImmediately])

  const dispatchCollisionEnter = useCallback((payload: CollisionEnterPayload) => {
    if (contagionEnabled) {
      enqueueContagionPair(
        resolveCollisionEntity(payload, 'target'),
        resolveCollisionEntity(payload, 'other'),
      )
    }
    onCollisionEnter?.(payload)
  }, [contagionEnabled, enqueueContagionPair, onCollisionEnter])

  const handleCollisionEnter = useCallback((payload: CollisionEnterPayload) => {
    activate(payload)
    dispatchCollisionEnter(payload)
  }, [activate, dispatchCollisionEnter])

  const handleIntersectionEnter = useCallback((payload: IntersectionEnterPayload) => {
    if (sensorPreCollision) {
      activate(payload)
    }
    onIntersectionEnter?.(payload)
  }, [activate, onIntersectionEnter, sensorPreCollision])

  const bodylessChildren = useMemo(() => {
    if (!canBodylessArm || activated) return childArray

    return childArray.map((child) => {
      if (!isColliderElement(child)) return child
      const childProps = (child.props ?? {}) as Record<string, unknown>
      const childOnIntersectionEnter = childProps.onIntersectionEnter as ((payload: IntersectionEnterPayload) => void) | undefined
      const childOnCollisionEnter = childProps.onCollisionEnter as ((payload: CollisionEnterPayload) => void) | undefined

      return cloneElement(child, {
        sensor: noneActivated,
        onCollisionEnter: noneActivated
          ? undefined
          : (payload: CollisionEnterPayload) => {
            activate(payload)
            dispatchCollisionEnter(payload)
            childOnCollisionEnter?.(payload)
          },
        onIntersectionEnter: noneActivated
          ? (payload: IntersectionEnterPayload) => {
            activate(payload)
            onIntersectionEnter?.(payload)
            childOnIntersectionEnter?.(payload)
          }
          : childOnIntersectionEnter,
      })
    })
  }, [canBodylessArm, activated, childArray, activate, onIntersectionEnter, dispatchCollisionEnter, noneActivated])

  if (canBodylessArm && !activated) {
    return (
      <group
        {...(position !== undefined ? { position } : {})}
        {...(rotation !== undefined ? { rotation } : {})}
        {...(quaternion !== undefined ? { quaternion } : {})}
        {...(scale !== undefined ? { scale } : {})}
      >
        {bodylessChildren}
      </group>
    )
  }

  const sensor = sensorPreCollision ? !activated : sensorOverride

  return (
    <RigidBody
      ref={bodyRef}
      {...props}
      {...(position !== undefined ? { position } : {})}
      {...(rotation !== undefined ? { rotation } : {})}
      {...(quaternion !== undefined ? { quaternion } : {})}
      {...(scale !== undefined ? { scale } : {})}
      userData={mergedUserData}
      sensor={sensor}
      onCollisionEnter={handleCollisionEnter}
      onIntersectionEnter={handleIntersectionEnter}
    >
      {children}
    </RigidBody>
  )
}
