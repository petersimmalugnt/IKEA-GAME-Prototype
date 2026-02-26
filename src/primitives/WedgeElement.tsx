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

export type WedgeElementProps = Simplify<ElementTransformProps & ElementRenderProps & PhysicsProps & {
    width?: number
    height?: number
    depth?: number
    color?: MaterialColorIndex
    singleTone?: boolean
    hidden?: boolean
    align?: Align3
}>

/**
 * Build a wedge (right-angle ramp) BufferGeometry.
 *
 * The wedge sits in a bounding box of [width × height × depth] centred at
 * the origin.  Cross-section is a right triangle with the 90° angle at
 * the bottom-right corner (+x, -h/2).
 *
 *   Side view (looking along Z):
 *
 *        D (+w/2, +h/2)
 *        |\\
 *        | \\
 *        |  \\
 *   B ---+---A
 * (-w/2, -h/2)  (+w/2, -h/2)
 *
 *   Two faces along Z form the triangular ends,
 *   plus bottom, vertical right face, and hypotenuse slope.
 */
function createWedgeGeometry(width: number, height: number, depth: number): THREE.BufferGeometry {
    const hw = width / 2
    const hh = height / 2
    const hd = depth / 2

    // Front triangle (z = +hd): A, B → bottom; D → top-right
    const A_f: [number, number, number] = [hw, -hh, hd]   // bottom-right
    const B_f: [number, number, number] = [-hw, -hh, hd]   // bottom-left
    const D_f: [number, number, number] = [hw, hh, hd]     // top-right

    // Back triangle (z = -hd)
    const A_b: [number, number, number] = [hw, -hh, -hd]
    const B_b: [number, number, number] = [-hw, -hh, -hd]
    const D_b: [number, number, number] = [hw, hh, -hd]

    const positions: number[] = []
    const normals: number[] = []

    function pushVert(pos: [number, number, number], normal: [number, number, number]) {
        positions.push(...pos)
        normals.push(...normal)
    }

    // Front face (z = +hd) – triangle B_f, A_f, D_f
    const nFront: [number, number, number] = [0, 0, 1]
    pushVert(B_f, nFront)
    pushVert(A_f, nFront)
    pushVert(D_f, nFront)

    // Back face (z = -hd) – triangle B_b, D_b, A_b (winding reversed)
    const nBack: [number, number, number] = [0, 0, -1]
    pushVert(B_b, nBack)
    pushVert(D_b, nBack)
    pushVert(A_b, nBack)

    // Bottom face (y = -hh) – quad B_f, B_b, A_b, A_f
    const nBottom: [number, number, number] = [0, -1, 0]
    pushVert(B_f, nBottom)
    pushVert(B_b, nBottom)
    pushVert(A_b, nBottom)
    pushVert(B_f, nBottom)
    pushVert(A_b, nBottom)
    pushVert(A_f, nBottom)

    // Right face (x = +hw) – quad A_f, A_b, D_b, D_f (vertical)
    const nRight: [number, number, number] = [1, 0, 0]
    pushVert(A_f, nRight)
    pushVert(A_b, nRight)
    pushVert(D_b, nRight)
    pushVert(A_f, nRight)
    pushVert(D_b, nRight)
    pushVert(D_f, nRight)

    // Slope face (hypotenuse) – quad B_f, D_f, D_b, B_b
    const slopeNormal = new THREE.Vector3(-height, width, 0).normalize()
    const nSlope: [number, number, number] = [slopeNormal.x, slopeNormal.y, slopeNormal.z]
    pushVert(B_f, nSlope)
    pushVert(D_f, nSlope)
    pushVert(D_b, nSlope)
    pushVert(B_f, nSlope)
    pushVert(D_b, nSlope)
    pushVert(B_b, nSlope)

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
    return geometry
}

export const WedgeElement = forwardRef<PositionTargetHandle, WedgeElementProps>(function WedgeElement({
    width = 0.2,
    height = 0.2,
    depth = 0.2,
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
        () => getAlignOffset([width, height, depth], align),
        [width, height, depth, align?.x, align?.y, align?.z],
    )
    const contagionColorOverride = useContagionColorOverride(entityId)
    const resolvedColor = contagionColorOverride ?? color

    const geometry = useMemo(
        () => createWedgeGeometry(width, height, depth),
        [width, height, depth],
    )

    // ConvexHull vertices: the 6 corners of the wedge
    const hullVertices = useMemo(() => {
        const hw = width / 2
        const hh = height / 2
        const hd = depth / 2
        return new Float32Array([
            // bottom-left-front, bottom-right-front, top-right-front (D_f)
            -hw, -hh, hd,
            hw, -hh, hd,
            hw, hh, hd,
            // bottom-left-back, bottom-right-back, top-right-back (D_b)
            -hw, -hh, -hd,
            hw, -hh, -hd,
            hw, hh, -hd,
        ])
    }, [width, height, depth])

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
            <primitive object={geometry} attach="geometry" />
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
