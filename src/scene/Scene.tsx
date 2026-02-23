import { useEffect, useRef } from 'react'
import { Physics } from '@react-three/rapier'
import { Stats } from '@react-three/drei'
import { InvisibleFloor } from '@/primitives/InvisibleFloor'
import { Player, type PlayerHandle } from '@/scene/Player'
import { GameEffects } from '@/render/Effects'
import { CameraSystemProvider } from '@/camera/CameraSystem'
import { BenchmarkDebugContent } from '@/debug/BenchmarkDebugContent'
import { CameraFrustumOverlay } from '@/debug/CameraFrustumOverlay'
import { DebugCameraPiP } from '@/debug/DebugCameraPiP'
import { GameKeyboardControls } from '@/input/GameKeyboardControls'
import { SETTINGS } from '@/settings/GameSettings'
import { useSettingsVersion } from '@/settings/settingsStore'
import { ExternalControlBridge } from '@/input/control/ExternalControlBridge'
import { MotionSystemProvider } from '@/scene/TransformMotion'
import { ContagionRuntime } from '@/gameplay/ContagionRuntime'
import { LiveLevelSync } from '@/LiveLevelSync'
import { LevelRenderer } from '@/LevelRenderer'
import { useLevelStore } from '@/levelStore'

export function Scene() {
  useSettingsVersion()
  const playerRef = useRef<PlayerHandle | null>(null)
  const isDebug = SETTINGS.debug.enabled
  const loadLevel = useLevelStore((state) => state.loadLevel)

  useEffect(() => {
    loadLevel(SETTINGS.level.defaultFile)
  }, [loadLevel])

  return (
    <GameKeyboardControls>
      <ExternalControlBridge />
      <LiveLevelSync />
      <Physics gravity={[0, -9.81, 0]} debug={isDebug && SETTINGS.debug.showColliders}>
        <ContagionRuntime />
        <GameEffects />
        <CameraSystemProvider playerRef={playerRef}>
          <MotionSystemProvider>
            {/* SPELAREN */}
            <Player contagionCarrier contagionColor={8} position={[-1.4, .4, .4]} />

            {/* LEVEL FROM STORE (file or live sync) */}
            <LevelRenderer />

            {/* DEBUG BENCHMARK + STREAMING */}
            <BenchmarkDebugContent />
            {(isDebug && SETTINGS.debug.showCameraFrustum) || (isDebug && SETTINGS.debug.showDebugCamera) ? (
              <CameraFrustumOverlay />
            ) : null}
            {isDebug && SETTINGS.debug.showDebugCamera && <DebugCameraPiP />}

            <InvisibleFloor />
          </MotionSystemProvider>
        </CameraSystemProvider>
      </Physics>

      {/* Debug: FPS / MS / MB overlay */}
      {isDebug && SETTINGS.debug.showStats && <Stats />}
    </GameKeyboardControls>
  )
}
