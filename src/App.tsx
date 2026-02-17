import * as THREE from 'three'
import { Canvas } from '@react-three/fiber'
import { OrthographicCamera } from '@react-three/drei'
import { GameLights } from './Lights'
// import { GameEffects } from './Effects' <--- BORTTAGEN HÄRIFRÅN
import { SETTINGS, getActiveBackground } from './GameSettings'
import { Scene } from './Scene'
import { GltfConverter } from './GltfConverter'
import { DocsPage } from './DocsPage'

export default function App() {
  const isConverter = window.location.pathname === '/converter'
  const isDocs = window.location.pathname === '/docs'

  if (isConverter) {
    return <GltfConverter />
  }

  if (isDocs) {
    return <DocsPage />
  }

  const backgroundColor = getActiveBackground()
  const initialCameraPosition = SETTINGS.camera.mode === 'follow'
    ? SETTINGS.camera.follow.offset
    : SETTINGS.camera.static.position

  return (
    <div style={{ width: '100vw', height: '100vh', background: backgroundColor }}>
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

        <GameLights />

        <Scene />
      </Canvas>
    </div>
  )
}
