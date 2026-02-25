import * as THREE from 'three'
import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react'
import { CuboidCollider, type RigidBodyProps } from '@react-three/rapier'
import { C4DMaterial } from '@/render/Materials'
import type { MaterialColorIndex, Vec3 } from '@/settings/GameSettings'
import type { PositionTargetHandle } from '@/scene/PositionTargetHandle'
import { toRadians, useSurfaceId } from '@/scene/SceneHelpers'
import { GameRigidBody } from '../physics/GameRigidBody'
import type { PhysicsProps } from '@/physics/PhysicsWrapper'
import { getAlignOffset, type Align3 } from '@/geometry/align'
import { useContagionColorOverride } from '@/gameplay/gameplayStore'
import type { ElementRenderProps, ElementTransformProps, Simplify } from './ElementBaseProps'

export type StepsElementProps = Simplify<ElementTransformProps & ElementRenderProps & PhysicsProps & {
    width?: number
    height?: number
    depth?: number
    stepCount?: number
    color?: MaterialColorIndex
    singleTone?: boolean
    hidden?: boolean
    align?: Align3
}>

type StepColliderDef = {
    position: Vec3
    halfExtents: Vec3
}

/**
 * Create a merged staircase geometry + collider definitions.
 *
 * Steps ascend along +X: step 0 is at the bottom-left, step N-1 is at the
 * top-right.  Each step occupies the full depth (Z) and is
 * (width/stepCount) wide and ((i+1)/stepCount * height) tall.
 */
function createStepsData(width: number, height: number, depth: number, stepCount: number) {
    const hw = width / 2
    const hh = height / 2
    const hd = depth / 2
    const stepWidth = width / stepCount
    const stepHeight = height / stepCount

    const geometries: THREE.BoxGeometry[] = []
    const colliders: StepColliderDef[] = []

    for (let i = 0; i < stepCount; i++) {
        const thisStepH = stepHeight // height of just this step layer
        const cumulativeH = (i + 1) * stepHeight
        const stepCenterX = -hw + (i * stepWidth) + (stepWidth / 2)
        const stepCenterY = -hh + (cumulativeH / 2)

        // The visual box for this step: full height from bottom to this step's top
        const box = new THREE.BoxGeometry(stepWidth, cumulativeH, depth)
        box.translate(stepCenterX, stepCenterY, 0)
        geometries.push(box)

        // Collider: the "new" portion of this step only (avoid overlap)
        const colliderCenterY = -hh + (i * stepHeight) + (thisStepH / 2)
        const colliderWidth = width - (i * stepWidth) // extends from this step to the right edge
        const colliderCenterX = -hw + (i * stepWidth) + (colliderWidth / 2)

        colliders.push({
            position: [colliderCenterX, colliderCenterY, 0],
            halfExtents: [colliderWidth / 2, thisStepH / 2, hd],
        })
    }

    // Merge all step geometries into one
    const merged = mergeBoxGeometries(geometries)
    geometries.forEach((g) => g.dispose())

    return { geometry: merged, colliders }
}

/**
 * Merge multiple BoxGeometries into a single BufferGeometry.
 */
function mergeBoxGeometries(geometries: THREE.BoxGeometry[]): THREE.BufferGeometry {
    // Collect all position/normal data and re-index
    let totalVertices = 0
    let totalIndices = 0

    for (const geo of geometries) {
        totalVertices += geo.getAttribute('position').count
        totalIndices += (geo.index ? geo.index.count : geo.getAttribute('position').count)
    }

    const positions = new Float32Array(totalVertices * 3)
    const normals = new Float32Array(totalVertices * 3)
    const indices = new Uint32Array(totalIndices)

    let vertexOffset = 0
    let indexOffset = 0

    for (const geo of geometries) {
        const pos = geo.getAttribute('position') as THREE.BufferAttribute
        const norm = geo.getAttribute('normal') as THREE.BufferAttribute
        const idx = geo.index

        for (let i = 0; i < pos.count * 3; i++) {
            positions[vertexOffset * 3 + i] = pos.array[i]
            normals[vertexOffset * 3 + i] = norm.array[i]
        }

        if (idx) {
            for (let i = 0; i < idx.count; i++) {
                indices[indexOffset + i] = idx.array[i] + vertexOffset
            }
            indexOffset += idx.count
        } else {
            for (let i = 0; i < pos.count; i++) {
                indices[indexOffset + i] = i + vertexOffset
            }
            indexOffset += pos.count
        }

        vertexOffset += pos.count
    }

    const merged = new THREE.BufferGeometry()
    merged.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
    merged.setIndex(new THREE.BufferAttribute(indices, 1))
    return merged
}

export const StepsElement = forwardRef<PositionTargetHandle, StepsElementProps>(function StepsElement({
    width = 0.2,
    height = 0.2,
    depth = 0.2,
    stepCount = 4,
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
    const clampedStepCount = Math.max(2, Math.min(20, Math.round(stepCount)))
    const anchorOffset = useMemo<Vec3>(
        () => getAlignOffset([width, height, depth], align),
        [width, height, depth, align?.x, align?.y, align?.z],
    )
    const contagionColorOverride = useContagionColorOverride(entityId)
    const resolvedColor = contagionColorOverride ?? color

    const stepsData = useMemo(
        () => createStepsData(width, height, depth, clampedStepCount),
        [width, height, depth, clampedStepCount],
    )

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
            <primitive object={stepsData.geometry} attach="geometry" />
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
            contagion={{
                entityId,
                carrier: contagionCarrier === true,
                infectable: contagionInfectable !== false,
                colorIndex: contagionColor ?? resolvedColor,
            }}
        >
            {stepsData.colliders.map((col, i) => {
                const absPos: Vec3 = [
                    anchorOffset[0] + col.position[0],
                    anchorOffset[1] + col.position[1],
                    anchorOffset[2] + col.position[2],
                ]
                return (
                    <CuboidCollider
                        key={i}
                        args={col.halfExtents}
                        position={absPos}
                        restitution={restitution}
                    />
                )
            })}
            {mesh}
        </GameRigidBody>
    )
})
