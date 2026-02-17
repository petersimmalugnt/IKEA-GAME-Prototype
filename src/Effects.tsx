import { EffectComposer, SMAA } from '@react-three/postprocessing'
import { SMAAPreset } from 'postprocessing'
import { SurfaceIdEffect } from './SurfaceIdEffect'
import { SETTINGS, type SMAAPresetName } from './GameSettings'

const SMAA_PRESET_MAP: Record<SMAAPresetName, SMAAPreset> = {
  low: SMAAPreset.LOW,
  medium: SMAAPreset.MEDIUM,
  high: SMAAPreset.HIGH,
  ultra: SMAAPreset.ULTRA,
}

export function GameEffects() {
  if (!SETTINGS.lines.enabled) return null

  const smaaPreset = SMAA_PRESET_MAP[SETTINGS.lines.smaaPreset]

  return (
    <EffectComposer autoClear={false} multisampling={SETTINGS.lines.composerMultisampling}>
      <SurfaceIdEffect
        thickness={SETTINGS.lines.thickness}
        color={SETTINGS.colors.outline}
        creaseAngle={SETTINGS.lines.creaseAngle}
        idThreshold={SETTINGS.lines.threshold}
        debug={false}
      />
      {SETTINGS.lines.smaaEnabled ? <SMAA preset={smaaPreset} /> : <></>}
    </EffectComposer>
  )
}
