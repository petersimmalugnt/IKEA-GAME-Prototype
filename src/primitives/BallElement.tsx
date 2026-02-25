import { forwardRef, useMemo, type ForwardRefExoticComponent, type RefAttributes } from 'react'
import type { PositionTargetHandle } from '@/scene/PositionTargetHandle'
import { SphereElement, type SphereElementProps } from './SphereElement'
import type { Align3 } from '@/geometry/align'
import type { Simplify } from './ElementBaseProps'

export const BALL_SIZE_PRESETS = ['lg', 'md', 'sm', 'xs'] as const
export type BallSizePreset = (typeof BALL_SIZE_PRESETS)[number]

export type BallElementProps = Simplify<Omit<SphereElementProps, 'radius' | 'align'> & {
    sizePreset?: BallSizePreset
    align?: Align3
}>

export type BallElementComponent = ForwardRefExoticComponent<
    BallElementProps & RefAttributes<PositionTargetHandle>
>

export const BALL_RADII_M: Record<BallSizePreset, number> = {
    lg: 0.1,
    md: 0.05,
    sm: 0.025,
    xs: 0.0125,
}

// Sfärisk byggkloss med storlekspresets.
// Align/fysik/render hanteras av SphereElement.
export const BallElement: BallElementComponent = forwardRef<PositionTargetHandle, BallElementProps>(function BallElement({
    sizePreset = 'lg',
    align,
    ...props
}, ref) {
    const radius = BALL_RADII_M[sizePreset]

    const finalAlign = useMemo(() => ({
        y: 0,
        ...align,
    }), [align])

    return (
        <SphereElement
            ref={ref}
            {...props}
            radius={radius}
            align={finalAlign}
        />
    )
})
