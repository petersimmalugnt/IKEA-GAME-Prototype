import { forwardRef, useMemo, type ForwardRefExoticComponent, type RefAttributes } from 'react'
import type { Vec3 } from '@/settings/GameSettings'
import type { PositionTargetHandle } from '@/scene/PositionTargetHandle'
import { StepsElement, type StepsElementProps } from './StepsElement'
import type { Align3 } from '@/geometry/align'
import type { Simplify } from './ElementBaseProps'

export const STEPS_BLOCK_SIZE_PRESETS = ['lg', 'md', 'sm'] as const
export const STEPS_BLOCK_HEIGHT_PRESETS = ['sm', 'md', 'lg'] as const

export type StepsBlockSizePreset = (typeof STEPS_BLOCK_SIZE_PRESETS)[number]
export type StepsBlockHeightPreset = (typeof STEPS_BLOCK_HEIGHT_PRESETS)[number]

// Hardcoded step resolution for StepsBlockElement.
// Tune this value manually for perf/quality tradeoff.
const STEPS_BLOCK_STEP_COUNT = 4

export type StepsBlockElementProps = Simplify<Omit<StepsElementProps, 'width' | 'height' | 'depth' | 'align' | 'stepCount'> & {
    sizePreset?: StepsBlockSizePreset
    heightPreset?: StepsBlockHeightPreset
    align?: Align3
}>

export type StepsBlockElementComponent = ForwardRefExoticComponent<
    StepsBlockElementProps & RefAttributes<PositionTargetHandle>
>

const STEPS_BLOCK_FOOTPRINTS_M: Record<StepsBlockSizePreset, [number, number]> = {
    lg: [0.2, 0.2],
    md: [0.1, 0.2],
    sm: [0.05, 0.1],
}

const STEPS_BLOCK_HEIGHTS_M: Record<StepsBlockHeightPreset, number> = {
    sm: 0.2,
    md: 0.4,
    lg: 0.6,
}

export function resolveStepsBlockSize(
    sizePreset: StepsBlockSizePreset,
    heightPreset: StepsBlockHeightPreset,
): Vec3 {
    const footprint = STEPS_BLOCK_FOOTPRINTS_M[sizePreset]
    const height = STEPS_BLOCK_HEIGHTS_M[heightPreset]
    // Steps always ascend along width(X), height(Y), depth(Z)
    return [footprint[0], height, footprint[1]]
}

// Trapp-byggkloss med måttpresets och konfigurerbart antal steg.
// Align/fysik/render hanteras av StepsElement.
export const StepsBlockElement: StepsBlockElementComponent = forwardRef<PositionTargetHandle, StepsBlockElementProps>(function StepsBlockElement({
    sizePreset = 'lg',
    heightPreset = 'sm',
    align,
    color = 1,
    ...props
}, ref) {
    const finalSize = useMemo<Vec3>(
        () => resolveStepsBlockSize(sizePreset, heightPreset),
        [sizePreset, heightPreset],
    )

    const finalAlign = useMemo(() => ({
        y: 0,
        ...align,
    }), [align])

    return (
        <StepsElement
            ref={ref}
            {...props}
            color={color}
            width={finalSize[0]}
            height={finalSize[1]}
            depth={finalSize[2]}
            stepCount={STEPS_BLOCK_STEP_COUNT}
            align={finalAlign}
        />
    )
})
