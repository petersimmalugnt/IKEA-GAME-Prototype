import { forwardRef, useMemo, type ForwardRefExoticComponent, type RefAttributes } from 'react'
import type { PositionTargetHandle } from '@/scene/PositionTargetHandle'
import { ConeElement, type ConeElementProps } from './ConeElement'
import type { Align3 } from '@/geometry/align'
import type { Simplify } from './ElementBaseProps'

export const CONE_BLOCK_SIZE_PRESETS = ['lg', 'md', 'sm', 'xs'] as const
export const CONE_BLOCK_HEIGHT_PRESETS = ['sm', 'md', 'lg'] as const

export type ConeBlockSizePreset = (typeof CONE_BLOCK_SIZE_PRESETS)[number]
export type ConeBlockHeightPreset = (typeof CONE_BLOCK_HEIGHT_PRESETS)[number]

// Hardcoded visual/collider resolution for ConeBlockElement.
// Tune these values manually for perf/quality tradeoff.
const CONE_BLOCK_VISUAL_SEGMENTS = 12
const CONE_BLOCK_COLLIDER_SEGMENTS = 6

export type ConeBlockElementProps = Simplify<Omit<ConeElementProps, 'radius' | 'height' | 'align' | 'segments' | 'colliderSegments'> & {
    sizePreset?: ConeBlockSizePreset
    heightPreset?: ConeBlockHeightPreset
    align?: Align3
}>

export type ConeBlockElementComponent = ForwardRefExoticComponent<
    ConeBlockElementProps & RefAttributes<PositionTargetHandle>
>

const CONE_BLOCK_RADII_M: Record<ConeBlockSizePreset, number> = {
    lg: 0.1,
    md: 0.05,
    sm: 0.025,
    xs: 0.0125,
}

const CONE_BLOCK_HEIGHTS_M: Record<ConeBlockHeightPreset, number> = {
    sm: 0.2,
    md: 0.4,
    lg: 0.6,
}

export function resolveConeBlockSize(
    sizePreset: ConeBlockSizePreset,
    heightPreset: ConeBlockHeightPreset,
): { radius: number; height: number } {
    return {
        radius: CONE_BLOCK_RADII_M[sizePreset],
        height: CONE_BLOCK_HEIGHTS_M[heightPreset],
    }
}

// Konisk byggkloss med måttpresets.
// Align/fysik/render hanteras av ConeElement.
export const ConeBlockElement: ConeBlockElementComponent = forwardRef<PositionTargetHandle, ConeBlockElementProps>(function ConeBlockElement({
    sizePreset = 'lg',
    heightPreset = 'sm',
    align,
    ...props
}, ref) {
    const { radius, height } = useMemo(
        () => resolveConeBlockSize(sizePreset, heightPreset),
        [sizePreset, heightPreset],
    )

    const finalAlign = useMemo(() => ({
        y: 0,
        ...align,
    }), [align])

    return (
        <ConeElement
            ref={ref}
            {...props}
            radius={radius}
            height={height}
            segments={CONE_BLOCK_VISUAL_SEGMENTS}
            colliderSegments={CONE_BLOCK_COLLIDER_SEGMENTS}
            align={finalAlign}
        />
    )
})
