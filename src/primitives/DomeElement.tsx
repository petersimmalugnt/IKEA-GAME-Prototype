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

export type DomeElementProps = Simplify<ElementTransformProps & ElementRenderProps & PhysicsProps & {
    radius?: number
    segments?: number
    colliderSegments?: number
    color?: MaterialColorIndex
    singleTone?: boolean
    hidden?: boolean
    align?: Align3
}>

/**
 * Create a half-sphere (dome) geometry: upper hemisphere + flat circle bottom.
 * Merged into a single BufferGeometry for a single draw call.
 */
function createDomeGeometry(radius: number, segments: number): THREE.BufferGeometry {
    // Upper hemisphere: phiStart=0, phiLength=2π, thetaStart=0, thetaLength=π/2
    const hemisphere = new THREE.SphereGeometry(radius, segments, Math.max(4, Math.floor(segments / 2)), 0, Math.PI * 2, 0, Math.PI / 2)

    // Flat bottom circle
    const bottom = new THREE.CircleGeometry(radius, segments)
    bottom.rotateX(Math.PI / 2) // face downward

    // Centre at origin: shift from [0, radius] range to [-radius/2, radius/2]
    hemisphere.translate(0, -radius / 2, 0)
    bottom.translate(0, -radius / 2, 0)

    const merged = mergeGeometries(hemisphere, bottom)
    hemisphere.dispose()
    bottom.dispose()
    return merged
}

/**
 * Simple merge of two BufferGeometries into one (position + normal only).
 */
function mergeGeometries(a: THREE.BufferGeometry, b: THREE.BufferGeometry): THREE.BufferGeometry {
    const aPos = a.getAttribute('position') as THREE.BufferAttribute
    const aNorm = a.getAttribute('normal') as THREE.BufferAttribute
    const bPos = b.getAttribute('position') as THREE.BufferAttribute
    const bNorm = b.getAttribute('normal') as THREE.BufferAttribute

    // Handle indexed geometries
    const aIndices = a.index ? Array.from(a.index.array) : Array.from({ length: aPos.count }, (_, i) => i)
    const bIndices = b.index ? Array.from(b.index.array) : Array.from({ length: bPos.count }, (_, i) => i)

    const totalVertices = aPos.count + bPos.count
    const totalIndices = aIndices.length + bIndices.length

    const positions = new Float32Array(totalVertices * 3)
    const normals = new Float32Array(totalVertices * 3)
    const indices = new Uint32Array(totalIndices)

    // Copy A
    for (let i = 0; i < aPos.count * 3; i++) {
        positions[i] = aPos.array[i]
        normals[i] = aNorm.array[i]
    }

    // Copy B (offset)
    const offset = aPos.count
    for (let i = 0; i < bPos.count * 3; i++) {
        positions[offset * 3 + i] = bPos.array[i]
        normals[offset * 3 + i] = bNorm.array[i]
    }

    // Copy indices
    for (let i = 0; i < aIndices.length; i++) {
        indices[i] = aIndices[i]
    }
    for (let i = 0; i < bIndices.length; i++) {
        indices[aIndices.length + i] = bIndices[i] + offset
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
    geometry.setIndex(new THREE.BufferAttribute(indices, 1))
    return geometry
}

export const DomeElement = forwardRef<PositionTargetHandle, DomeElementProps>(function DomeElement({
    radius = 0.1,
    segments = 24,
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
        () => getAlignOffset([radius * 2, radius, radius * 2], align),
        [radius, align?.x, align?.y, align?.z],
    )
    const contagionColorOverride = useContagionColorOverride(entityId)
    const resolvedColor = contagionColorOverride ?? color

    const geometry = useMemo(
        () => createDomeGeometry(radius, segments),
        [radius, segments],
    )

    // ConvexHull: hemisphere points + bottom ring
    const hullVertices = useMemo(() => {
        const verts: number[] = []
        const yShift = -radius / 2
        // Bottom ring
        for (let i = 0; i < colliderSegments; i++) {
            const angle = (i / colliderSegments) * Math.PI * 2
            const x = Math.cos(angle) * radius
            const z = Math.sin(angle) * radius
            verts.push(x, 0 + yShift, z)
        }
        // Hemisphere points (quarter arcs)
        const arcSegments = Math.max(2, Math.floor(colliderSegments / 2))
        for (let i = 0; i < colliderSegments; i++) {
            const azimuth = (i / colliderSegments) * Math.PI * 2
            for (let j = 1; j <= arcSegments; j++) {
                const elevation = (j / arcSegments) * (Math.PI / 2)
                const r = Math.cos(elevation) * radius
                const y = Math.sin(elevation) * radius
                verts.push(Math.cos(azimuth) * r, y + yShift, Math.sin(azimuth) * r)
            }
        }
        // Top point
        verts.push(0, radius + yShift, 0)
        return new Float32Array(verts)
    }, [radius, colliderSegments])

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
