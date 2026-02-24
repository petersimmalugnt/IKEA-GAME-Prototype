import * as THREE from 'three'
import { Canvas } from '@react-three/fiber'
import { OrthographicCamera } from '@react-three/drei'
import { Leva } from 'leva'
// import { GameEffects } from '@/render/Effects' <--- BORTTAGEN HÄRIFRÅN
import { SETTINGS, getActiveBackground } from '@/settings/GameSettings'
import { useSettingsVersion } from '@/settings/settingsStore'
import { Scene } from '@/scene/Scene'
import { GltfConverter } from '@/tools/GltfConverter'
import { DocsPage } from '@/ui/docs/DocsPage'
import { ControlCenter } from '@/ui/ControlCenter'
import { ScoreHud } from '@/ui/ScoreHud'

export default function App() {
  const isConverter = window.location.pathname === '/converter'
  const isDocs = window.location.pathname === '/docs'

  if (isConverter) {
    return <GltfConverter />
  }

  if (isDocs) {
    return <DocsPage />
  }

  return <GameApp />
}

function GameApp() {
  useSettingsVersion()

  const backgroundColor = getActiveBackground()
  const initialCameraPosition = SETTINGS.camera.mode === 'follow'
    ? SETTINGS.camera.follow.offset
    : SETTINGS.camera.static.position

  return (
    <div style={{ width: '100vw', height: '100vh', background: backgroundColor }}>
      <Leva collapsed />
      <ControlCenter />
      <ScoreHud />
      <Canvas
        shadows={{ type: THREE.BasicShadowMap }}
        dpr={[1, 2]}
        gl={{
          antialias: false,
          stencil: false,
          depth: true,
        }}
      >
        <color attach="background" args={[backgroundColor]} />

        <OrthographicCamera
          makeDefault
          zoom={SETTINGS.camera.base.zoom}
          position={initialCameraPosition}
          near={SETTINGS.camera.base.near}
          far={SETTINGS.camera.base.far}
        />

        <Scene />
      </Canvas>
    </div>
  )
}
