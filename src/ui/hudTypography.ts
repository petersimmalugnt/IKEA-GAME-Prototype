import type { CSSProperties } from 'react'

type PopdotAxes = {
  wght: number
  slnt: number
  wdth: number
}

export type PopdotStyleKey = 'style1' | 'style2' | 'style3' | 'style4' | 'style5'
export const POPDOT_SHADOW_COLOR = '#141414'
export type PopdotShadowSize = 2 | 4 | 8 | 12 | 16

const SHADOW_DENSITY_BY_SIZE: Record<PopdotShadowSize, number> = {
  2: 0.5,
  4: 0.5,
  8: 1,
  12: 2,
  16: 2,
}

const SHADOW_OFFSETS_BY_SIZE: Record<PopdotShadowSize, number[]> = {
  2: [],
  4: [],
  8: [],
  12: [],
  16: [],
}

for (const rawSize of [2, 4, 8, 12, 16] as const) {
  const size = rawSize as PopdotShadowSize
  const density = SHADOW_DENSITY_BY_SIZE[size]
  const offsets = SHADOW_OFFSETS_BY_SIZE[size]
  for (let shadowOffset = density; shadowOffset <= size; shadowOffset += density) {
    offsets.push(shadowOffset)
  }
}

export function resolvePopdotShadowOffsets(size: PopdotShadowSize): number[] {
  return SHADOW_OFFSETS_BY_SIZE[size]
}

export function createPopdotShadowStyle(size: PopdotShadowSize): CSSProperties {
  const offsets = resolvePopdotShadowOffsets(size)
  return {
    textShadow: offsets
      .map((shadowOffset) => `${shadowOffset}px ${shadowOffset}px 0 ${POPDOT_SHADOW_COLOR}`)
      .join(', '),
  }
}

export const POPDOT_SHADOW_STYLE = createPopdotShadowStyle(4)

const POPDOT_BASE: CSSProperties = {
  fontFamily: '"popdot", "Instrument Sans", sans-serif',
  lineHeight: '0.75em',
  letterSpacing: '0.08em',
}

export const POPDOT_LIGATURES_BASE: CSSProperties = {
  fontVariantLigatures: 'common-ligatures discretionary-ligatures contextual',
  fontFeatureSettings: '"liga" 1, "clig" 1, "calt" 1, "dlig" 1',
}

function resolveFontVariationSettings(axes: PopdotAxes): string {
  return `"wght" ${axes.wght}, "slnt" ${axes.slnt}, "wdth" ${axes.wdth}`
}

function createPopdotStyle(axes: PopdotAxes): CSSProperties {
  return {
    ...POPDOT_BASE,
    ...POPDOT_LIGATURES_BASE,
    fontVariationSettings: resolveFontVariationSettings(axes),
    fontWeight: `${axes.wght}`,
  }
}

export const POPDOT_STYLE_1: CSSProperties = createPopdotStyle({ wght: 350, slnt: 100, wdth: 0 })
export const POPDOT_STYLE_2: CSSProperties = createPopdotStyle({ wght: 200, slnt: 100, wdth: 100 })
export const POPDOT_STYLE_3: CSSProperties = createPopdotStyle({ wght: 200, slnt: 0, wdth: 0 })
export const POPDOT_STYLE_4: CSSProperties = createPopdotStyle({ wght: 150, slnt: 0, wdth: 0 })
export const POPDOT_STYLE_5: CSSProperties = createPopdotStyle({ wght: 375, slnt: 100, wdth: 100 })

export const POPDOT_STYLE_BY_KEY: Record<PopdotStyleKey, CSSProperties> = {
  style1: POPDOT_STYLE_1,
  style2: POPDOT_STYLE_2,
  style3: POPDOT_STYLE_3,
  style4: POPDOT_STYLE_4,
  style5: POPDOT_STYLE_5,
}
