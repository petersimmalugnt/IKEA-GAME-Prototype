import * as THREE from 'three'
import type { RefObject } from 'react'
import { SETTINGS } from '@/settings/GameSettings'

type GameLightsProps = {
  lightRef?: RefObject<THREE.DirectionalLight | null>
}

export function GameLights({ lightRef }: GameLightsProps) {
  const area = SETTINGS.light.shadowArea

  return (
    <group>
      <directionalLight
        ref={lightRef}
        position={SETTINGS.light.position}
        intensity={SETTINGS.light.intensity}
        castShadow
        shadow-mapSize={[SETTINGS.light.shadowMapSize, SETTINGS.light.shadowMapSize]}
        shadow-bias={SETTINGS.light.shadowBias}
        shadow-normalBias={SETTINGS.light.shadowNormalBias}
      >
        <orthographicCamera
          attach="shadow-camera"
          args={[-area, area, area, -area]}
          near={0.1}
          far={100}
        />
      </directionalLight>
      <ambientLight intensity={0} />
    </group>
  )
}
