import { useCallback, useEffect, useState } from 'react'
import { useSettingsVersion } from '@/settings/settingsStore'
import {
    savePreset,
    loadPresetFromFile,
    loadBundledPreset,
    fetchPresetManifest,
} from '@/settings/presets'
import { bump } from '@/settings/settingsStore'
import { PALETTE_VARIANT_NAMES } from '@/settings/GameSettings.types'
import type { PaletteVariantName } from '@/settings/GameSettings.types'
import { settingsSections, type FieldDescriptor, type SectionDescriptor } from './settingsSchema'
import {
    CheckboxField,
    SelectField,
    TextField,
    NumberField,
    ColorField,
    Vec3Field,
    AxisMaskField,
    StringArrayEditor,
    PaletteEditor,
    ButtonField,
    PresetControls,
} from './inputs/Fields'
import './gameSettingsPanel.css'

// ═══════════════════════════════════════════════════════════════════
// Section collapse state – persisted at module scope across mount/unmount
// ═══════════════════════════════════════════════════════════════════

type CollapseState = Record<string, boolean>

function createInitialCollapseState(): CollapseState {
    const initial: CollapseState = {}
    for (const section of settingsSections) {
        initial[section.key] = true
    }
    initial['presets'] = true
    return initial
}

/** Module-scoped: survives component unmount so hide/show preserves section state */
let persistedCollapseState: CollapseState | null = null

// ═══════════════════════════════════════════════════════════════════
// Field renderer
// ═══════════════════════════════════════════════════════════════════

function renderField(field: FieldDescriptor, index: number) {
    if (field.visible && !field.visible()) return null

    switch (field.type) {
        case 'boolean':
            return <CheckboxField key={index} label={field.label} value={field.get()} onChange={field.set} />
        case 'number':
            return <NumberField key={index} label={field.label} value={field.get()} onChange={field.set} min={field.min} max={field.max} step={field.step} />
        case 'text':
            return <TextField key={index} label={field.label} value={field.get()} onChange={field.set} />
        case 'select':
            return <SelectField key={index} label={field.label} value={field.get()} onChange={field.set} options={field.options} />
        case 'color':
            return <ColorField key={index} label={field.label} value={field.get()} onChange={field.set} />
        case 'vec3':
            return <Vec3Field key={index} label={field.label} value={field.get()} onChange={field.set} min={field.min} max={field.max} step={field.step} />
        case 'axisMask':
            return <AxisMaskField key={index} label={field.label} value={field.get()} onChange={field.set} />
        case 'stringArray':
            return <StringArrayEditor key={index} label={field.label} value={field.get()} onChange={field.set} />
        case 'paletteColors':
            return (
                <div key={index}>
                    {PALETTE_VARIANT_NAMES.map((name) => (
                        <PaletteEditor
                            key={name}
                            variantName={name}
                            variant={field.getVariant(name)}
                            onChange={(v) => field.setVariant(name, v)}
                        />
                    ))}
                </div>
            )
        case 'button':
            return <ButtonField key={index} label={field.label} onClick={field.action} />
        default:
            return null
    }
}

// ═══════════════════════════════════════════════════════════════════
// Section component
// ═══════════════════════════════════════════════════════════════════

function Section({
    section,
    collapsed,
    onToggle,
}: {
    section: SectionDescriptor
    collapsed: boolean
    onToggle: () => void
}) {
    // Re-read settings version so fields update on bump()
    useSettingsVersion()

    return (
        <div className="gsp-section">
            <div className="gsp-section-header" onClick={onToggle}>
                <span className="gsp-section-title">{section.label}</span>
                <span className="gsp-icon gsp-icon-sm gsp-section-chevron">
                    {collapsed ? 'expand_more' : 'expand_less'}
                </span>
            </div>
            {!collapsed && (
                <div className="gsp-section-body">
                    {section.fields.map((field, i) => renderField(field, i))}
                </div>
            )}
        </div>
    )
}

// ═══════════════════════════════════════════════════════════════════
// Presets section
// ═══════════════════════════════════════════════════════════════════

function PresetsSection({
    collapsed,
    onToggle,
}: {
    collapsed: boolean
    onToggle: () => void
}) {
    const [bundledPresets, setBundledPresets] = useState<string[]>([])

    useEffect(() => {
        fetchPresetManifest().then(setBundledPresets)
    }, [])

    const handleSave = useCallback((name: string) => {
        savePreset(name)
    }, [])

    const handleLoadFile = useCallback(async (file: File) => {
        await loadPresetFromFile(file)
        bump()
    }, [])

    const handleLoadBundled = useCallback(async (name: string) => {
        await loadBundledPreset(name)
        bump()
    }, [])

    return (
        <div className="gsp-section">
            <div className="gsp-section-header" onClick={onToggle}>
                <span className="gsp-section-title">Presets</span>
                <span className="gsp-icon gsp-icon-sm gsp-section-chevron">
                    {collapsed ? 'expand_more' : 'expand_less'}
                </span>
            </div>
            {!collapsed && (
                <PresetControls
                    onSave={handleSave}
                    onLoadFile={handleLoadFile}
                    onLoadBundled={handleLoadBundled}
                    bundledPresets={bundledPresets}
                />
            )}
        </div>
    )
}

// ═══════════════════════════════════════════════════════════════════
// Main panel
// ═══════════════════════════════════════════════════════════════════

type GameSettingsPanelProps = {
    onClose: () => void
}

export function GameSettingsPanel({ onClose }: GameSettingsPanelProps) {
    // Initialise from module-scoped state (first open = all expanded, subsequent = last state)
    const [collapseState, setCollapseState] = useState<CollapseState>(() => {
        return persistedCollapseState ?? createInitialCollapseState()
    })

    // Sync back to module scope on every change
    useEffect(() => {
        persistedCollapseState = collapseState
    }, [collapseState])

    const toggleSection = useCallback((key: string) => {
        setCollapseState((prev) => ({ ...prev, [key]: !prev[key] }))
    }, [])

    // Prevent pointer events from reaching the canvas
    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        e.stopPropagation()
    }, [])

    return (
        <div className="gsp-panel" onPointerDown={handlePointerDown}>
            <div className="gsp-scroll">
                {settingsSections.map((section) => (
                    <Section
                        key={section.key}
                        section={section}
                        collapsed={!!collapseState[section.key]}
                        onToggle={() => toggleSection(section.key)}
                    />
                ))}
                <PresetsSection
                    collapsed={!!collapseState['presets']}
                    onToggle={() => toggleSection('presets')}
                />
            </div>
        </div>
    )
}
