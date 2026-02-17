import { useRef } from 'react'
import { Physics } from '@react-three/rapier'
import { Stats } from '@react-three/drei'
import { CubeElement, CylinderElement, SplineElement, InvisibleFloor } from './SceneComponents'
import { Player, type PlayerHandle } from './Player'
import { SplineAndAnimTest } from './assets/models/SplineAndAnimTest'
import { GameEffects } from './Effects'
import { CameraFollow } from './CameraFollow'
import { BenchmarkDebugContent } from './debug/BenchmarkDebugContent'
import { GameKeyboardControls } from './GameKeyboardControls'
import { SETTINGS } from './GameSettings'

const isDebug = SETTINGS.debug.enabled

export function Scene() {
  const playerRef = useRef<PlayerHandle | null>(null)

  return (
    <GameKeyboardControls>
      <Physics gravity={[0, -9.81, 0]} debug={isDebug && SETTINGS.debug.showColliders}>
        <GameEffects />
        <CameraFollow playerRef={playerRef} />

        {/* SPELAREN */}
        <Player ref={playerRef} position={[0.1, 0.27, 1.3]} />

        {/* --- NIVÅN --- */}

        {/* BLÅ RAMP */}
        <CubeElement
          size={[0.5, 2, 0.03]}
          color="two"
          physics="dynamic"
          position={[0.1, 0.5, 0.75]}
          rotation={[-61, 0, 0]}
          mass={0.3}
          friction={3}
        />

        {/* VINRÖDA ELEMENT */}
        <CubeElement
          size={[1.1, 0.48, 0.03]}
          physics="dynamic"
          position={[0.2, 0.24, 0.65]}
          mass={0.2}
          friction={0.5}
          lockRotations
        />

        <CubeElement
          size={[0.5, 1, 0.03]}
          physics="dynamic"
          position={[0.8, 0.5, 0]}
          mass={0.3}
        />

        {/* CYLINDER */}
        <CylinderElement
          radius={0.3}
          height={0.2}
          physics="dynamic"
          position={[2, 0.5, 0]}
          rotation={[90, 0, 0]}
          colliderSegments={16}
        />

        {/* FBX PIPELINE TEST */}
        <SplineAndAnimTest position={[-1.5, .5, 0]} scale={0.01} animation="Anim1" />

        {/* DEBUG BENCHMARK + STREAMING */}
        <BenchmarkDebugContent playerRef={playerRef} />

        <InvisibleFloor />
      </Physics>

      {/* Debug: FPS / MS / MB overlay */}
      {isDebug && SETTINGS.debug.showStats && <Stats />}
    </GameKeyboardControls>
  )
}
