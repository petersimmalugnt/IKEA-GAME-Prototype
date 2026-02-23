import * as THREE from 'three'
import { forwardRef, type ReactNode } from 'react'
import { type ThreeElements } from '@react-three/fiber'
import { C4DMaterial } from '@/render/Materials'
import { useSurfaceId } from '@/scene/SceneHelpers'
import { GameRigidBody } from '@/physics/GameRigidBody'
import type { GamePhysicsBodyType } from '@/physics/physicsTypes'

type C4DMeshProps = ThreeElements['mesh'] & {
  children?: ReactNode
}

// Wrapper för C4D-mesh som genererar unikt surfaceId för outline-effekten
export const C4DMesh = forwardRef<THREE.Mesh, C4DMeshProps>(function C4DMesh({ children, ...props }, ref) {
  const surfaceId = useSurfaceId()
  return (
    <mesh ref={ref} userData={{ surfaceId }} {...props}>
      {children}
    </mesh>
  )
})

export { C4DMaterial }
export { SplineElement, SPLINE_CURVE_TYPES } from '@/primitives/SplineElement'
export type { SplineElementProps, CurveType } from '@/primitives/SplineElement'
export { GameRigidBody }
export type { GamePhysicsBodyType }
