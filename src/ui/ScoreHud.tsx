import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { AUDIO_SETTINGS } from '@/audio/AudioSettings'
import { isAudioUnlocked, subscribeAudioUnlocked } from '@/audio/SoundManager'
import { useGameplayStore } from '@/gameplay/gameplayStore'
import { SETTINGS } from '@/settings/GameSettings'
import { useSettingsVersion } from '@/settings/settingsStore'

function formatScore(value: number): string {
  const truncated = Number.isFinite(value) ? Math.trunc(value) : 0
  const sign = truncated < 0 ? '-' : ''
  const digits = Math.abs(truncated).toString()
  return `${sign}${digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}`
}

const LIFE_LOSS_BLINK_DURATION_MS = 820

export function ScoreHud() {
  useSettingsVersion()
  const uiWhite = '#fff'
  const [audioUnlocked, setAudioUnlocked] = useState(() => isAudioUnlocked())
  const [blinkingLifeSlots, setBlinkingLifeSlots] = useState<number[]>([])
  const score = useGameplayStore((state) => state.score)
  const lastRunScore = useGameplayStore((state) => state.lastRunScore)
  const sessionHighScore = useGameplayStore((state) => state.sessionHighScore)
  const lives = useGameplayStore((state) => state.lives)
  const flowState = useGameplayStore((state) => state.flowState)
  const maxLives = Math.max(0, Math.trunc(SETTINGS.gameplay.lives.initial))
  const secondaryColor = SETTINGS.colors.outline
  const fontSize = '2rem'
  const margin = '1.5rem'
  const isTopHudHidden = flowState !== 'run'
  const topHudTransform = isTopHudHidden ? 'translateY(calc(-100% - ' + margin + '))' : 'translateY(0%)'
  const topHudOpacity = isTopHudHidden ? 0 : 1
  const isAudioOn = AUDIO_SETTINGS.enabled === true && audioUnlocked
  const previousLivesRef = useRef(lives)
  const blinkTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())

  const hudTextStyle: CSSProperties = {
    fontFamily: '"Instrument Sans", sans-serif',
    fontSize,
    lineHeight: 1,
    fontWeight: '400',
    letterSpacing: '0.01em',
    textTransform: 'uppercase',
  }

  useEffect(() => {
    return subscribeAudioUnlocked(() => {
      setAudioUnlocked(true)
    })
  }, [])

  useEffect(() => {
    const previousLives = previousLivesRef.current
    previousLivesRef.current = lives
    if (lives >= previousLives) return

    const clampedLives = Math.max(0, Math.min(maxLives, lives))
    const clampedPreviousLives = Math.max(0, Math.min(maxLives, previousLives))
    const lostStartSlot = clampedLives
    const lostEndSlot = clampedPreviousLives - 1
    if (lostEndSlot < lostStartSlot) return

    const lostSlots: number[] = []
    for (let slot = lostStartSlot; slot <= lostEndSlot; slot += 1) {
      lostSlots.push(slot)
    }
    if (lostSlots.length === 0) return

    setBlinkingLifeSlots((prev) => {
      if (prev.length === 0) return lostSlots
      const next = prev.slice()
      for (let i = 0; i < lostSlots.length; i += 1) {
        const slot = lostSlots[i]
        if (next.includes(slot)) continue
        next.push(slot)
      }
      return next
    })

    for (let i = 0; i < lostSlots.length; i += 1) {
      const slot = lostSlots[i]
      const existingTimer = blinkTimersRef.current.get(slot)
      if (existingTimer !== undefined) {
        clearTimeout(existingTimer)
      }
      const timer = setTimeout(() => {
        setBlinkingLifeSlots((prev) => prev.filter((value) => value !== slot))
        blinkTimersRef.current.delete(slot)
      }, LIFE_LOSS_BLINK_DURATION_MS)
      blinkTimersRef.current.set(slot, timer)
    }
  }, [lives, maxLives])

  useEffect(() => {
    return () => {
      blinkTimersRef.current.forEach((timer) => clearTimeout(timer))
      blinkTimersRef.current.clear()
    }
  }, [])

  const blinkingLifeSlotSet = new Set(blinkingLifeSlots)

  return (
    <>
      <div
        style={{
          position: 'absolute',
          top: margin,
          left: margin,
          zIndex: 30,
          pointerEvents: 'none',
          ...hudTextStyle,
          display: 'flex',
          alignItems: 'start',
          gap: '2ch',
          maxWidth: 'min(70vw, 52ch)',
          flexWrap: 'wrap',
          color: uiWhite,
          transform: topHudTransform,
          opacity: topHudOpacity,
          transition: 'transform 2s cubic-bezier(0.6, 0, 0, 1), opacity 2s cubic-bezier(0.6, 0, 0, 1)',
        }}
      >
        <div style={{ display: 'flex', gap: '1em', minWidth: 'max(15ch, calc(100vw / 4))' }}>
          <span>Score</span>
          <span>{formatScore(score)}</span>
        </div>
        <div style={{ display: 'flex', gap: '1em', fontSize: '0.4em', fontWeight: '500', paddingTop: '0.25em', letterSpacing: '0.025em' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1em', minWidth: 'max(15ch, calc(100vw / 12))' }}>
            <span>Prev.</span>
            <span>{formatScore(lastRunScore)}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1em', minWidth: 'max(15ch, calc(100vw / 12))' }}>
            <span>Best</span>
            <span>{formatScore(sessionHighScore)}</span>
          </div>
        </div>
      </div >

      {!isAudioOn && (
        <div
          style={{
            position: 'absolute',
            bottom: margin,
            right: margin,
            zIndex: 30,
            pointerEvents: 'none',
            ...hudTextStyle,
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '1ch',
            flexWrap: 'wrap',
            color: uiWhite,
            textAlign: 'right',
            textWrap: 'balance',
          }}
        >
          <span style={{ fontSize: '0.375em', fontWeight: '600', letterSpacing: '0.025em', maxWidth: '30ch' }}>Click anywhere to enable the soundtrack and SFX</span>
          <span
            style={{
              fontFamily: '"Material Symbols Outlined"',
              fontWeight: 400,
              fontStyle: 'normal',
              fontSize: '0.75em',
              lineHeight: '1em',
              letterSpacing: 'normal',
              textTransform: 'none',
              userSelect: 'none',
            }}
          >
            volume_off
          </span>
        </div>
      )}

      <div
        style={{
          position: 'absolute',
          top: margin,
          right: margin,
          zIndex: 30,
          pointerEvents: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: '0.125em',
          ...hudTextStyle,
          transform: topHudTransform,
          opacity: topHudOpacity,
          transition: 'transform 2s .15s cubic-bezier(0.6, 0, 0, 1), opacity 2s .15s cubic-bezier(0.6, 0, 0, 1)',
        }}
      >
        {Array.from({ length: maxLives }, (_, slotIndex) => {
          const isActiveLife = slotIndex < lives
          if (isActiveLife) {
            return (
              <span
                key={`life-slot-${slotIndex}`}
                className="material-icons"
                style={{
                  color: uiWhite,
                  fontSize: fontSize,
                  lineHeight: '1em',
                }}
              >
                favorite
              </span>
            )
          }
          const shouldBlink = blinkingLifeSlotSet.has(slotIndex)
          return (
            <span
              key={`life-slot-${slotIndex}`}
              className={shouldBlink ? 'material-icons life-loss-blink' : 'material-icons'}
              style={{
                color: secondaryColor,
                fontSize: fontSize,
                lineHeight: '1em',
                ['--life-loss-dark' as any]: secondaryColor,
              } as CSSProperties}
            >
              favorite
            </span>
          )
        })}
      </div>
    </>
  )
}
