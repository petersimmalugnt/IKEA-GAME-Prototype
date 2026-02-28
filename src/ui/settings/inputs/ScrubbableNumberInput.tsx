import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type PointerEvent as ReactPointerEvent } from 'react'

const SCRUB_START_THRESHOLD_PX = 4
const SCRUB_PIXELS_PER_STEP = 24

type NumberInputValue = number | ''

type ScrubbableNumberInputProps = {
    className?: string
    value: NumberInputValue
    onChange: (value: NumberInputValue) => void
    step?: number
    scrubFineStep?: number
    scrubCoarseStep?: number
    min?: number
    max?: number
    placeholder?: string
    disabled?: boolean
    readOnly?: boolean
    defaultValue?: NumberInputValue
    onScrubStart?: () => void
    onScrubEnd?: (commit: boolean) => void
}

type InteractionState = {
    pointerId: number
    startClientX: number
    startClientY: number
    lastClientX: number
    lastClientY: number
    pendingPixelDelta: number
    startRawValue: NumberInputValue
    currentValue: number
    active: boolean
    hasChanged: boolean
}

function clampNumber(value: number, min?: number, max?: number): number {
    let result = value
    if (typeof min === 'number') result = Math.max(min, result)
    if (typeof max === 'number') result = Math.min(max, result)
    return result
}

function getStepPrecision(step: number): number {
    if (!Number.isFinite(step)) return 0
    const normalized = String(step)
    const exponentialIndex = normalized.indexOf('e-')
    if (exponentialIndex >= 0) {
        const exponent = Number(normalized.slice(exponentialIndex + 2))
        return Number.isFinite(exponent) ? exponent : 0
    }
    const fractional = normalized.split('.')[1]
    return fractional ? fractional.length : 0
}

function roundToPrecision(value: number, precision: number): number {
    if (!Number.isFinite(value)) return value
    const factor = 10 ** precision
    return Math.round(value * factor) / factor
}

function getScrubIncrement(
    event: PointerEvent | MouseEvent,
    fineStep: number,
    coarseStep: number,
): number {
    return event.shiftKey ? coarseStep : fineStep
}

function isPrimaryButtonPressed(event: PointerEvent | MouseEvent): boolean {
    return (event.buttons & 1) === 1
}

function toIncrementPrecision(value: number, increment: number): number {
    return roundToPrecision(value, getStepPrecision(increment))
}

function requestPointerLockSafe(element: HTMLElement): void {
    if (typeof element.requestPointerLock !== 'function') return
    try {
        const result = element.requestPointerLock()
        if (result && typeof (result as Promise<void>).catch === 'function') {
            ; (result as Promise<void>).catch(() => { })
        }
    } catch {
        // Pointer lock can be rejected by browser/security policies.
    }
}

function exitPointerLockSafe(element: HTMLElement): void {
    if (document.pointerLockElement !== element) return
    if (typeof document.exitPointerLock !== 'function') return
    try {
        document.exitPointerLock()
    } catch {
        // Ignore failed unlock attempts.
    }
}

export function ScrubbableNumberInput({
    className,
    value,
    onChange,
    step = 0.1,
    scrubFineStep,
    scrubCoarseStep,
    min,
    max,
    placeholder,
    disabled = false,
    readOnly = false,
    defaultValue,
    onScrubStart,
    onScrubEnd,
}: ScrubbableNumberInputProps) {
    const inputRef = useRef<HTMLInputElement | null>(null)
    const interactionRef = useRef<InteractionState | null>(null)
    const cleanupListenersRef = useRef<(() => void) | null>(null)
    const restoreBodyStyleRef = useRef<{ userSelect: string; cursor: string } | null>(null)
    const onChangeRef = useRef(onChange)
    const onScrubStartRef = useRef(onScrubStart)
    const onScrubEndRef = useRef(onScrubEnd)
    const disabledRef = useRef(disabled)
    const readOnlyRef = useRef(readOnly)

    const [isFocused, setIsFocused] = useState(false)
    const [isScrubbing, setIsScrubbing] = useState(false)

    const safeStep = useMemo(() => {
        if (!Number.isFinite(step) || step === 0) return 0.1
        return Math.abs(step)
    }, [step])
    const resolvedScrubFineStep = useMemo(() => {
        if (typeof scrubFineStep === 'number' && Number.isFinite(scrubFineStep) && scrubFineStep !== 0) {
            return Math.abs(scrubFineStep)
        }
        return safeStep
    }, [scrubFineStep, safeStep])
    const resolvedScrubCoarseStep = useMemo(() => {
        if (typeof scrubCoarseStep === 'number' && Number.isFinite(scrubCoarseStep) && scrubCoarseStep !== 0) {
            return Math.abs(scrubCoarseStep)
        }
        return resolvedScrubFineStep * 10
    }, [scrubCoarseStep, resolvedScrubFineStep])

    const restoreBodyInteractionState = useCallback(() => {
        if (!restoreBodyStyleRef.current) return
        const previous = restoreBodyStyleRef.current
        restoreBodyStyleRef.current = null
        document.body.style.userSelect = previous.userSelect
        document.body.style.cursor = previous.cursor
    }, [])

    const setScrubBodyInteractionState = useCallback(() => {
        if (restoreBodyStyleRef.current) return
        restoreBodyStyleRef.current = {
            userSelect: document.body.style.userSelect,
            cursor: document.body.style.cursor,
        }
        document.body.style.userSelect = 'none'
        document.body.style.cursor = 'ew-resize'
    }, [])

    const cleanupGlobalListeners = useCallback(() => {
        cleanupListenersRef.current?.()
        cleanupListenersRef.current = null
    }, [])

    useEffect(() => {
        onChangeRef.current = onChange
    }, [onChange])

    useEffect(() => {
        onScrubStartRef.current = onScrubStart
    }, [onScrubStart])

    useEffect(() => {
        onScrubEndRef.current = onScrubEnd
    }, [onScrubEnd])

    useEffect(() => {
        disabledRef.current = disabled
    }, [disabled])

    useEffect(() => {
        readOnlyRef.current = readOnly
    }, [readOnly])

    const finishInteraction = useCallback((commit: boolean) => {
        const interaction = interactionRef.current
        if (!interaction) return

        const input = inputRef.current
        const wasActive = interaction.active
        const didChange = interaction.hasChanged
        const shouldCommit = commit && wasActive && didChange

        if (wasActive && !commit) {
            onChangeRef.current(interaction.startRawValue)
        }

        if (wasActive) {
            onScrubEndRef.current?.(shouldCommit)
        } else if (commit && input && !disabledRef.current && !readOnlyRef.current) {
            input.focus()
        }

        if (input && input.hasPointerCapture?.(interaction.pointerId)) {
            input.releasePointerCapture(interaction.pointerId)
        }

        if (input) {
            exitPointerLockSafe(input)
        }

        cleanupGlobalListeners()
        restoreBodyInteractionState()
        interactionRef.current = null
        setIsScrubbing(false)
    }, [cleanupGlobalListeners, restoreBodyInteractionState])

    const startScrubIfNeeded = useCallback((event: PointerEvent | MouseEvent, interaction: InteractionState): boolean => {
        if (interaction.active) return true

        const dx = event.clientX - interaction.startClientX
        const dy = event.clientY - interaction.startClientY
        const distance = Math.hypot(dx, dy)
        if (!Number.isFinite(distance) || distance < SCRUB_START_THRESHOLD_PX) {
            return false
        }

        interaction.active = true
        interaction.hasChanged = false
        setIsScrubbing(true)
        setScrubBodyInteractionState()
        onScrubStartRef.current?.()

        const input = inputRef.current
        if (input) {
            requestPointerLockSafe(input)
        }

        interaction.lastClientX = event.clientX
        interaction.lastClientY = event.clientY
        return true
    }, [setScrubBodyInteractionState])

    const handlePointerMove = useCallback((event: PointerEvent | MouseEvent) => {
        const interaction = interactionRef.current
        if (!interaction) return

        const input = inputRef.current
        if (!input) return

        const pointerLockActive = document.pointerLockElement === input
        if (interaction.active && !pointerLockActive && !isPrimaryButtonPressed(event)) {
            finishInteraction(true)
            return
        }
        if (!pointerLockActive && 'pointerId' in event && event.pointerId !== interaction.pointerId) return

        const started = startScrubIfNeeded(event, interaction)
        if (!started) {
            interaction.lastClientX = event.clientX
            interaction.lastClientY = event.clientY
            return
        }

        const deltaX = pointerLockActive
            ? event.movementX
            : event.clientX - interaction.lastClientX
        const deltaY = pointerLockActive
            ? event.movementY
            : event.clientY - interaction.lastClientY

        interaction.lastClientX = event.clientX
        interaction.lastClientY = event.clientY

        interaction.pendingPixelDelta += (deltaX - deltaY)
        if (!Number.isFinite(interaction.pendingPixelDelta)) return

        const stepCount = Math.trunc(interaction.pendingPixelDelta / SCRUB_PIXELS_PER_STEP)
        if (stepCount === 0) return

        interaction.pendingPixelDelta -= stepCount * SCRUB_PIXELS_PER_STEP
        const scrubIncrement = getScrubIncrement(event, resolvedScrubFineStep, resolvedScrubCoarseStep)
        const deltaValue = stepCount * scrubIncrement

        const nextValue = toIncrementPrecision(
            clampNumber(interaction.currentValue + deltaValue, min, max),
            scrubIncrement,
        )

        if (nextValue === interaction.currentValue) return

        interaction.currentValue = nextValue
        interaction.hasChanged = true
        onChangeRef.current(nextValue)
    }, [finishInteraction, max, min, resolvedScrubCoarseStep, resolvedScrubFineStep, startScrubIfNeeded])

    const handlePointerUp = useCallback((event?: PointerEvent | MouseEvent) => {
        if (event && isPrimaryButtonPressed(event)) return
        finishInteraction(true)
    }, [finishInteraction])

    const handlePointerCancel = useCallback((event?: PointerEvent | MouseEvent) => {
        const interaction = interactionRef.current
        if (!interaction) return
        if (interaction.active) {
            return
        }
        const input = inputRef.current
        const pointerLockActive = input !== null && document.pointerLockElement === input
        if (pointerLockActive) return
        if (event && isPrimaryButtonPressed(event)) return
        finishInteraction(false)
    }, [finishInteraction])

    const handleWindowBlur = useCallback(() => {
        const input = inputRef.current
        if (input && document.pointerLockElement === input) return
        finishInteraction(true)
    }, [finishInteraction])

    const handleKeyDown = useCallback((event: KeyboardEvent) => {
        if (event.key !== 'Escape') return
        if (!interactionRef.current?.active) return
        event.preventDefault()
        finishInteraction(false)
    }, [finishInteraction])

    const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLInputElement>) => {
        if (disabled || readOnly) return
        if (event.button !== 0) return

        if (event.altKey && defaultValue !== undefined) {
            event.preventDefault()
            onChangeRef.current(defaultValue)
            return
        }

        if (isFocused) return
        event.preventDefault()

        const startRawValue = typeof value === 'number' ? value : ''
        const startNumericValue = typeof value === 'number'
            ? value
            : (typeof min === 'number' ? min : 0)

        interactionRef.current = {
            pointerId: event.pointerId,
            startClientX: event.clientX,
            startClientY: event.clientY,
            lastClientX: event.clientX,
            lastClientY: event.clientY,
            pendingPixelDelta: 0,
            startRawValue,
            currentValue: clampNumber(startNumericValue, min, max),
            active: false,
            hasChanged: false,
        }

        event.currentTarget.setPointerCapture?.(event.pointerId)

        const pointerMove = (nativeEvent: PointerEvent) => handlePointerMove(nativeEvent)
        const mouseMove = (nativeEvent: MouseEvent) => handlePointerMove(nativeEvent)
        const pointerUp = (nativeEvent: PointerEvent) => handlePointerUp(nativeEvent)
        const mouseUp = (nativeEvent: MouseEvent) => handlePointerUp(nativeEvent)
        const pointerCancel = (nativeEvent: PointerEvent) => handlePointerCancel(nativeEvent)
        const windowBlur = () => handleWindowBlur()
        const keyDown = (nativeEvent: KeyboardEvent) => handleKeyDown(nativeEvent)
        const pointerLockChange = () => { }
        const pointerLockError = () => { }

        window.addEventListener('pointermove', pointerMove)
        window.addEventListener('mousemove', mouseMove)
        window.addEventListener('pointerup', pointerUp)
        window.addEventListener('mouseup', mouseUp)
        window.addEventListener('pointercancel', pointerCancel)
        window.addEventListener('blur', windowBlur)
        window.addEventListener('keydown', keyDown, true)
        document.addEventListener('pointerlockchange', pointerLockChange)
        document.addEventListener('pointerlockerror', pointerLockError)

        cleanupListenersRef.current = () => {
            window.removeEventListener('pointermove', pointerMove)
            window.removeEventListener('mousemove', mouseMove)
            window.removeEventListener('pointerup', pointerUp)
            window.removeEventListener('mouseup', mouseUp)
            window.removeEventListener('pointercancel', pointerCancel)
            window.removeEventListener('blur', windowBlur)
            window.removeEventListener('keydown', keyDown, true)
            document.removeEventListener('pointerlockchange', pointerLockChange)
            document.removeEventListener('pointerlockerror', pointerLockError)
        }
    }, [
        defaultValue,
        disabled,
        handleKeyDown,
        handlePointerCancel,
        handlePointerMove,
        handlePointerUp,
        handleWindowBlur,
        isFocused,
        max,
        min,
        readOnly,
        value,
    ])

    const handleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
        const raw = event.target.value.trim()
        if (raw === '') {
            onChangeRef.current('')
            return
        }
        onChangeRef.current(Number(raw))
    }, [])

    useEffect(() => () => {
        finishInteraction(true)
    }, [finishInteraction])

    const cursor = disabled || readOnly
        ? 'not-allowed'
        : (isScrubbing ? 'ew-resize' : (isFocused ? 'text' : 'ew-resize'))

    return (
        <input
            ref={inputRef}
            className={className}
            type="number"
            step={safeStep}
            value={value}
            {...(min !== undefined ? { min } : {})}
            {...(max !== undefined ? { max } : {})}
            {...(placeholder !== undefined ? { placeholder } : {})}
            {...(disabled ? { disabled } : {})}
            {...(readOnly ? { readOnly } : {})}
            style={{ cursor }}
            onFocus={() => setIsFocused(true)}
            onBlur={() => {
                setIsFocused(false)
                if (interactionRef.current && !interactionRef.current.active) {
                    finishInteraction(true)
                }
            }}
            onPointerDown={handlePointerDown}
            onChange={handleChange}
        />
    )
}
