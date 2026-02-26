import { forwardRef, useMemo, type ForwardRefExoticComponent, type RefAttributes } from 'react'
import type { PositionTargetHandle } from '@/scene/PositionTargetHandle'
import { DomeElement, type DomeElementProps } from './DomeElement'
import type { Align3 } from '@/geometry/align'
import type { Simplify } from './ElementBaseProps'

export const DOME_BLOCK_SIZE_PRESETS = ['lg', 'md', 'sm', 'xs'] as const
export type DomeBlockSizePreset = (typeof DOME_BLOCK_SIZE_PRESETS)[number]

// Hardcoded visual/collider resolution for DomeBlockElement.
// Tune these values manually for perf/quality tradeoff.
const DOME_BLOCK_VISUAL_SEGMENTS = 16
const DOME_BLOCK_COLLIDER_SEGMENTS = 6

export type DomeBlockElementProps = Simplify<Omit<DomeElementProps, 'radius' | 'align' | 'segments' | 'colliderSegments'> & {
    sizePreset?: DomeBlockSizePreset
    align?: Align3
}>

export type DomeBlockElementComponent = ForwardRefExoticComponent<
    DomeBlockElementProps & RefAttributes<PositionTargetHandle>
>

export const DOME_BLOCK_RADII_M: Record<DomeBlockSizePreset, number> = {
    lg: 0.1,
    md: 0.05,
    sm: 0.025,
    xs: 0.0125,
}

// Halvsfärisk byggkloss (kupol) med storlekspresets.
// Align/fysik/render hanteras av DomeElement.
export const DomeBlockElement: DomeBlockElementComponent = forwardRef<PositionTargetHandle, DomeBlockElementProps>(function DomeBlockElement({
    sizePreset = 'lg',
    align,
    color = 1,
    ...props
}, ref) {
    const radius = DOME_BLOCK_RADII_M[sizePreset]

    const finalAlign = useMemo(() => ({
        y: 0,
        ...align,
    }), [align])

    return (
        <DomeElement
            ref={ref}
            {...props}
            color={color}
            radius={radius}
            segments={DOME_BLOCK_VISUAL_SEGMENTS}
            colliderSegments={DOME_BLOCK_COLLIDER_SEGMENTS}
            align={finalAlign}
        />
    )
})
