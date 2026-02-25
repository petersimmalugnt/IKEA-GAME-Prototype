import { forwardRef, useMemo, type ForwardRefExoticComponent, type RefAttributes } from 'react'
import type { Vec3 } from '@/settings/GameSettings'
import type { PositionTargetHandle } from '@/scene/PositionTargetHandle'
import { WedgeElement, type WedgeElementProps } from './WedgeElement'
import type { Align3 } from '@/geometry/align'
import type { Simplify } from './ElementBaseProps'

export const TRIANGLE_BLOCK_SIZE_PRESETS = ['lg', 'md', 'sm', 'xs', 'xxs'] as const
export const TRIANGLE_BLOCK_HEIGHT_PRESETS = ['sm', 'md', 'lg'] as const
export const TRIANGLE_BLOCK_PLANES = ['x', 'y', 'z'] as const

export type TriangleBlockSizePreset = (typeof TRIANGLE_BLOCK_SIZE_PRESETS)[number]
export type TriangleBlockHeightPreset = (typeof TRIANGLE_BLOCK_HEIGHT_PRESETS)[number]
export type TriangleBlockPlane = (typeof TRIANGLE_BLOCK_PLANES)[number]

export type TriangleBlockElementProps = Simplify<Omit<WedgeElementProps, 'width' | 'height' | 'depth' | 'align'> & {
    sizePreset?: TriangleBlockSizePreset
    heightPreset?: TriangleBlockHeightPreset
    plane?: TriangleBlockPlane
    align?: Align3
}>

export type TriangleBlockElementComponent = ForwardRefExoticComponent<
    TriangleBlockElementProps & RefAttributes<PositionTargetHandle>
>

// Same footprints and heights as BlockElement
const TRIANGLE_BLOCK_FOOTPRINTS_M: Record<TriangleBlockSizePreset, [number, number]> = {
    lg: [0.2, 0.2],
    md: [0.1, 0.2],
    sm: [0.05, 0.1],
    xs: [0.025, 0.05],
    xxs: [0.025, 0.025],
}

const TRIANGLE_BLOCK_HEIGHTS_M: Record<TriangleBlockHeightPreset, number> = {
    sm: 0.2,
    md: 0.4,
    lg: 0.6,
}

export function resolveTriangleBlockSize(
    sizePreset: TriangleBlockSizePreset,
    heightPreset: TriangleBlockHeightPreset,
    plane: TriangleBlockPlane,
): Vec3 {
    const footprint = TRIANGLE_BLOCK_FOOTPRINTS_M[sizePreset]
    const height = TRIANGLE_BLOCK_HEIGHTS_M[heightPreset]

    if (plane === 'x') return [height, footprint[0], footprint[1]]
    if (plane === 'z') return [footprint[0], footprint[1], height]
    return [footprint[0], height, footprint[1]]
}

// Triangulär byggkloss (kilform) med måttpresets.
// Align/fysik/render hanteras av WedgeElement.
export const TriangleBlockElement: TriangleBlockElementComponent = forwardRef<PositionTargetHandle, TriangleBlockElementProps>(function TriangleBlockElement({
    sizePreset = 'lg',
    heightPreset = 'sm',
    plane = 'y',
    align,
    ...props
}, ref) {
    const finalSize = useMemo<Vec3>(
        () => resolveTriangleBlockSize(sizePreset, heightPreset, plane),
        [sizePreset, heightPreset, plane],
    )

    const finalAlign = useMemo(() => ({
        y: 0,
        ...align,
    }), [align])

    return (
        <WedgeElement
            ref={ref}
            {...props}
            width={finalSize[0]}
            height={finalSize[1]}
            depth={finalSize[2]}
            align={finalAlign}
        />
    )
})
