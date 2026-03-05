import { EffectComposer, SMAA } from '@react-three/postprocessing'
import { SMAAPreset } from 'postprocessing'
import { SurfaceIdEffect } from '@/render/SurfaceIdEffect'
import { SETTINGS, type SMAAPresetName } from '@/settings/GameSettings'
import { useSettingsVersion } from '@/settings/settingsStore'

const SMAA_PRESET_MAP: Record<SMAAPresetName, SMAAPreset> = {
  low: SMAAPreset.LOW,
  medium: SMAAPreset.MEDIUM,
  high: SMAAPreset.HIGH,
  ultra: SMAAPreset.ULTRA,
}

export function GameEffects() {
  useSettingsVersion()

  const outlineEnabled = SETTINGS.lines.enabled
  const smaaEnabled = SETTINGS.lines.smaaEnabled

  if (!outlineEnabled) return null

  const smaaPreset = SMAA_PRESET_MAP[SETTINGS.lines.smaaPreset]

  return (
    <EffectComposer autoClear={false} multisampling={SETTINGS.lines.composerMultisampling}>
      {outlineEnabled ? (
        <SurfaceIdEffect
          thickness={SETTINGS.lines.thickness}
          color={SETTINGS.colors.outline}
          creaseAngle={SETTINGS.lines.creaseAngle}
          idThreshold={SETTINGS.lines.threshold}
          debug={false}
        />
      ) : <></>}
      {outlineEnabled && smaaEnabled ? <SMAA preset={smaaPreset} /> : <></>}
    </EffectComposer>
  )
}
