import { useCallback, useRef, useState, useEffect, type ChangeEvent } from 'react'
import { ScrubbableNumberInput } from './ScrubbableNumberInput'
import type { Vec3 } from '@/settings/GameSettings.types'

// ═══════════════════════════════════════════════════════════════════
// CheckboxField – custom white-square toggle (builder pattern)
// ═══════════════════════════════════════════════════════════════════

type CheckboxFieldProps = {
    label: string
    value: boolean
    onChange: (v: boolean) => void
}

export function CheckboxField({ label, value, onChange }: CheckboxFieldProps) {
    return (
        <div className="gsp-row gsp-row--checkbox">
            <label className="gsp-row-label">{label}</label>
            <label className="gsp-checkbox">
                <input
                    className="gsp-checkbox-hidden"
                    type="checkbox"
                    checked={value}
                    onChange={(e) => onChange(e.target.checked)}
                />
                <span
                    className={`gsp-checkbox-box ${value ? 'gsp-checkbox-box--on' : 'gsp-checkbox-box--off'}`}
                >
                    {value && (
                        <span className="gsp-icon gsp-checkbox-check">check</span>
                    )}
                </span>
            </label>
        </div>
    )
}

// ═══════════════════════════════════════════════════════════════════
// SelectField – dropdown with custom arrow (builder pattern)
// ═══════════════════════════════════════════════════════════════════

type SelectFieldProps = {
    label: string
    value: string
    options: readonly string[]
    onChange: (v: string) => void
}

export function SelectField({ label, value, options, onChange }: SelectFieldProps) {
    return (
        <div className="gsp-row">
            <label className="gsp-row-label">{label}</label>
            <div className="gsp-select-wrap">
                <select
                    className="gsp-select"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                >
                    {options.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                    ))}
                </select>
                <span className="gsp-select-divider" />
                <span className="gsp-select-arrow">
                    <span className="gsp-icon gsp-icon-sm">expand_more</span>
                </span>
            </div>
        </div>
    )
}

// ═══════════════════════════════════════════════════════════════════
// TextField
// ═══════════════════════════════════════════════════════════════════

type TextFieldProps = {
    label: string
    value: string
    onChange: (v: string) => void
}

export function TextField({ label, value, onChange }: TextFieldProps) {
    return (
        <div className="gsp-row">
            <label className="gsp-row-label">{label}</label>
            <input
                type="text"
                className="gsp-input"
                value={value}
                onChange={(e) => onChange(e.target.value)}
            />
        </div>
    )
}

// ═══════════════════════════════════════════════════════════════════
// NumberField – with ScrubbableNumberInput (builder pattern)
// ═══════════════════════════════════════════════════════════════════

type NumberFieldProps = {
    label: string
    value: number
    onChange: (v: number) => void
    min?: number
    max?: number
    step?: number
}

export function NumberField({ label, value, onChange, min, max, step = 0.1 }: NumberFieldProps) {
    const handleChange = useCallback((v: number | '') => {
        if (v === '') return
        onChange(v)
    }, [onChange])

    return (
        <div className="gsp-row">
            <label className="gsp-row-label">{label}</label>
            <ScrubbableNumberInput
                className="gsp-input"
                value={value}
                onChange={handleChange}
                step={step}
                min={min}
                max={max}
                defaultValue={0}
            />
        </div>
    )
}

// ═══════════════════════════════════════════════════════════════════
// ColorField
// ═══════════════════════════════════════════════════════════════════

type ColorFieldProps = {
    label: string
    value: string
    onChange: (v: string) => void
}

export function ColorField({ label, value, onChange }: ColorFieldProps) {
    return (
        <div className="gsp-row">
            <label className="gsp-row-label">{label}</label>
            <div className="gsp-color-row">
                <input
                    type="color"
                    className="gsp-color-swatch"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                />
                <input
                    type="text"
                    className="gsp-input gsp-color-hex"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                />
            </div>
        </div>
    )
}

// ═══════════════════════════════════════════════════════════════════
// Vec3Field – grid-cols-3, axis label + number (builder pattern)
// ═══════════════════════════════════════════════════════════════════

type Vec3FieldProps = {
    label: string
    value: Vec3
    onChange: (v: Vec3) => void
    min?: number
    max?: number
    step?: number
}

const AXIS_LABELS = ['X', 'Y', 'Z'] as const

export function Vec3Field({ label, value, onChange, min, max, step = 0.1 }: Vec3FieldProps) {
    return (
        <div className="gsp-row">
            <label className="gsp-row-label">{label}</label>
            <div className="gsp-vec3">
                {value.map((entry, index) => (
                    <div key={index} className="gsp-vec3-cell">
                        <span className="gsp-vec3-axis">{AXIS_LABELS[index]}</span>
                        <ScrubbableNumberInput
                            className="gsp-vec3-input"
                            step={step}
                            min={min}
                            max={max}
                            value={entry}
                            defaultValue={0}
                            onChange={(nextValue) => {
                                if (typeof nextValue !== 'number') return
                                const nextVec = [...value] as Vec3
                                nextVec[index] = nextValue
                                onChange(nextVec)
                            }}
                        />
                    </div>
                ))}
            </div>
        </div>
    )
}

// ═══════════════════════════════════════════════════════════════════
// AxisMaskField
// ═══════════════════════════════════════════════════════════════════

type AxisMaskValue = { x: boolean; y: boolean; z: boolean }

type AxisMaskFieldProps = {
    label: string
    value: AxisMaskValue
    onChange: (v: AxisMaskValue) => void
}

export function AxisMaskField({ label, value, onChange }: AxisMaskFieldProps) {
    return (
        <div className="gsp-row">
            <label className="gsp-row-label">{label}</label>
            <div className="gsp-axis-mask">
                {(['x', 'y', 'z'] as const).map((axis) => (
                    <div
                        key={axis}
                        className="gsp-axis-mask-cell"
                        onClick={() => onChange({ ...value, [axis]: !value[axis] })}
                    >
                        <span className="gsp-axis-mask-label">{axis.toUpperCase()}</span>
                        <span
                            className={`gsp-checkbox-box ${value[axis] ? 'gsp-checkbox-box--on' : 'gsp-checkbox-box--off'}`}
                            style={{ width: 16, height: 16, borderRadius: 3 }}
                        >
                            {value[axis] && (
                                <span className="gsp-icon gsp-checkbox-check" style={{ fontSize: 12 }}>check</span>
                            )}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    )
}

// ═══════════════════════════════════════════════════════════════════
// StringArrayEditor
// ═══════════════════════════════════════════════════════════════════

type StringArrayEditorProps = {
    label: string
    value: string[]
    onChange: (v: string[]) => void
}

export function StringArrayEditor({ label, value, onChange }: StringArrayEditorProps) {
    const handleItemChange = useCallback((index: number, newVal: string) => {
        const next = [...value]
        next[index] = newVal
        onChange(next)
    }, [value, onChange])

    const handleRemove = useCallback((index: number) => {
        const next = value.filter((_, i) => i !== index)
        onChange(next)
    }, [value, onChange])

    const handleAdd = useCallback(() => {
        onChange([...value, ''])
    }, [value, onChange])

    return (
        <div className="gsp-row">
            <label className="gsp-row-label">{label}</label>
            <div className="gsp-array">
                {value.map((item, i) => (
                    <div key={i} className="gsp-array-item">
                        <input
                            type="text"
                            className="gsp-input"
                            value={item}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => handleItemChange(i, e.target.value)}
                        />
                        <button
                            className="gsp-array-remove-btn"
                            onClick={() => handleRemove(i)}
                            title="Remove"
                        >
                            <span className="gsp-icon gsp-icon-sm">close</span>
                        </button>
                    </div>
                ))}
                <button className="gsp-array-add-btn" onClick={handleAdd}>+ Add</button>
            </div>
        </div>
    )
}

// ═══════════════════════════════════════════════════════════════════
// PaletteEditor
// ═══════════════════════════════════════════════════════════════════

type PaletteEntry = { base: string; mid?: string }
type PaletteVariant = { background: string; colors: PaletteEntry[] }

type PaletteEditorProps = {
    variantName: string
    variant: PaletteVariant
    onChange: (v: PaletteVariant) => void
}

export function PaletteEditor({ variantName, variant, onChange }: PaletteEditorProps) {
    const handleBgChange = useCallback((bg: string) => {
        onChange({ ...variant, background: bg })
    }, [variant, onChange])

    const handleColorChange = useCallback((index: number, field: 'base' | 'mid', val: string) => {
        const next = [...variant.colors]
        next[index] = { ...next[index], [field]: val }
        onChange({ ...variant, colors: next })
    }, [variant, onChange])

    const handleRemoveColor = useCallback((index: number) => {
        const next = variant.colors.filter((_, i) => i !== index)
        onChange({ ...variant, colors: next })
    }, [variant, onChange])

    const handleAddColor = useCallback(() => {
        onChange({ ...variant, colors: [...variant.colors, { base: '#ffffff' }] })
    }, [variant, onChange])

    return (
        <div className="gsp-palette-variant">
            <div className="gsp-palette-variant-title">{variantName}</div>
            <div className="gsp-color-row">
                <span style={{ fontSize: 10, color: 'var(--gsp-white-25)', width: 20 }}>BG</span>
                <input
                    type="color"
                    className="gsp-color-swatch"
                    value={variant.background}
                    onChange={(e) => handleBgChange(e.target.value)}
                />
            </div>
            {variant.colors.map((entry, i) => (
                <div key={i} className="gsp-palette-entry">
                    <span className="gsp-palette-entry-idx">{i}</span>
                    <input
                        type="color"
                        className="gsp-color-swatch"
                        value={entry.base}
                        onChange={(e) => handleColorChange(i, 'base', e.target.value)}
                        title="base"
                    />
                    <input
                        type="color"
                        className="gsp-color-swatch"
                        value={entry.mid || entry.base}
                        onChange={(e) => handleColorChange(i, 'mid', e.target.value)}
                        title="mid"
                        style={{ opacity: entry.mid ? 1 : 0.3 }}
                    />
                    <button
                        className="gsp-array-remove-btn"
                        onClick={() => handleRemoveColor(i)}
                        title="Remove color"
                    >
                        <span className="gsp-icon gsp-icon-sm">close</span>
                    </button>
                </div>
            ))}
            <button className="gsp-array-add-btn" onClick={handleAddColor}>+ Color</button>
        </div>
    )
}

// ═══════════════════════════════════════════════════════════════════
// ButtonField
// ═══════════════════════════════════════════════════════════════════

type ButtonFieldProps = {
    label: string
    onClick: () => void
}

export function ButtonField({ label, onClick }: ButtonFieldProps) {
    return (
        <div className="gsp-row">
            <button className="gsp-button" onClick={onClick}>{label}</button>
        </div>
    )
}

// ═══════════════════════════════════════════════════════════════════
// PresetControls
// ═══════════════════════════════════════════════════════════════════

type PresetControlsProps = {
    onSave: (name: string) => void
    onLoadFile: (file: File) => void
    onLoadBundled: (name: string) => void
    bundledPresets: string[]
}

export function PresetControls({ onSave, onLoadFile, onLoadBundled, bundledPresets }: PresetControlsProps) {
    const [presetName, setPresetName] = useState('default')
    const fileInputRef = useRef<HTMLInputElement | null>(null)

    return (
        <div className="gsp-preset-controls">
            <div className="gsp-preset-row">
                <input
                    type="text"
                    className="gsp-input"
                    style={{ flex: 1 }}
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                    placeholder="PRESET NAME"
                />
                <button className="gsp-preset-btn" onClick={() => onSave(presetName)}>Save</button>
            </div>
            <div className="gsp-preset-row">
                <button
                    className="gsp-preset-btn"
                    style={{ flex: 1 }}
                    onClick={() => {
                        if (!fileInputRef.current) {
                            const input = document.createElement('input')
                            input.type = 'file'
                            input.accept = '.json'
                            input.style.display = 'none'
                            input.addEventListener('change', () => {
                                const file = input.files?.[0]
                                if (file) onLoadFile(file)
                                input.value = ''
                            })
                            document.body.appendChild(input)
                            fileInputRef.current = input
                        }
                        fileInputRef.current.click()
                    }}
                >Load from File</button>
            </div>
            {bundledPresets.length > 0 && (
                <div className="gsp-preset-row">
                    <div className="gsp-select-wrap" style={{ flex: 1 }}>
                        <select
                            className="gsp-select"
                            defaultValue=""
                            onChange={(e) => {
                                if (e.target.value) onLoadBundled(e.target.value)
                                e.target.value = ''
                            }}
                        >
                            <option value="" disabled>Bundled presets…</option>
                            {bundledPresets.map((p) => (
                                <option key={p} value={p}>{p}</option>
                            ))}
                        </select>
                        <span className="gsp-select-divider" />
                        <span className="gsp-select-arrow">
                            <span className="gsp-icon gsp-icon-sm">expand_more</span>
                        </span>
                    </div>
                </div>
            )}
        </div>
    )
}
