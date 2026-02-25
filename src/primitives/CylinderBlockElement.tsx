import { forwardRef, useMemo, type ForwardRefExoticComponent, type RefAttributes } from 'react'
import type { PositionTargetHandle } from '@/scene/PositionTargetHandle'
import { CylinderElement, type CylinderElementProps } from './CylinderElement'
import type { Align3 } from '@/geometry/align'
import type { Simplify } from './ElementBaseProps'

export const CYLINDER_BLOCK_SIZE_PRESETS = ['lg', 'md', 'sm', 'xs'] as const
export const CYLINDER_BLOCK_HEIGHT_PRESETS = ['sm', 'md', 'lg'] as const

export type CylinderBlockSizePreset = (typeof CYLINDER_BLOCK_SIZE_PRESETS)[number]
export type CylinderBlockHeightPreset = (typeof CYLINDER_BLOCK_HEIGHT_PRESETS)[number]

// Hardcoded visual/collider resolution for CylinderBlockElement.
// Tune these values manually for perf/quality tradeoff.
const CYLINDER_BLOCK_VISUAL_SEGMENTS = 12
const CYLINDER_BLOCK_COLLIDER_SEGMENTS = 6

export type CylinderBlockElementProps = Simplify<Omit<CylinderElementProps, 'radius' | 'height' | 'align' | 'segments' | 'colliderSegments'> & {
    sizePreset?: CylinderBlockSizePreset
    heightPreset?: CylinderBlockHeightPreset
    align?: Align3
}>

export type CylinderBlockElementComponent = ForwardRefExoticComponent<
    CylinderBlockElementProps & RefAttributes<PositionTargetHandle>
>

// Radius derived from the larger footprint dimension / 2
const CYLINDER_BLOCK_RADII_M: Record<CylinderBlockSizePreset, number> = {
    lg: 0.1,
    md: 0.05,
    sm: 0.025,
    xs: 0.0125,
}

const CYLINDER_BLOCK_HEIGHTS_M: Record<CylinderBlockHeightPreset, number> = {
    sm: 0.2,
    md: 0.4,
    lg: 0.6,
}

export function resolveCylinderBlockSize(
    sizePreset: CylinderBlockSizePreset,
    heightPreset: CylinderBlockHeightPreset,
): { radius: number; height: number } {
    return {
        radius: CYLINDER_BLOCK_RADII_M[sizePreset],
        height: CYLINDER_BLOCK_HEIGHTS_M[heightPreset],
    }
}

// Cylindrisk byggkloss med måttpresets.
// Align/fysik/render hanteras av CylinderElement.
export const CylinderBlockElement: CylinderBlockElementComponent = forwardRef<PositionTargetHandle, CylinderBlockElementProps>(function CylinderBlockElement({
    sizePreset = 'lg',
    heightPreset = 'sm',
    align,
    ...props
}, ref) {
    const { radius, height } = useMemo(
        () => resolveCylinderBlockSize(sizePreset, heightPreset),
        [sizePreset, heightPreset],
    )

    const finalAlign = useMemo(() => ({
        y: 0,
        ...align,
    }), [align])

    return (
        <CylinderElement
            ref={ref}
            {...props}
            radius={radius}
            height={height}
            segments={CYLINDER_BLOCK_VISUAL_SEGMENTS}
            colliderSegments={CYLINDER_BLOCK_COLLIDER_SEGMENTS}
            align={finalAlign}
        />
    )
})
