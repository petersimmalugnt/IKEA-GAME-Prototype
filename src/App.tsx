import { OrthographicCamera } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Leva } from "leva";
import { useEffect, useState } from "react";
import * as THREE from "three";
// import { GameEffects } from '@/render/Effects' <--- BORTTAGEN HÄRIFRÅN
import { preload as preloadSounds } from "@/audio/SoundManager";
import { CursorTrailCanvas } from "@/input/CursorTrailCanvas";
import { Scene } from "@/scene/Scene";
import { SETTINGS, getActiveBackground } from "@/settings/GameSettings";
import { useSettingsVersion } from "@/settings/settingsStore";
import { GltfConverter } from "@/tools/GltfConverter";
import { ControlCenter } from "@/ui/ControlCenter";
import { DocsPage } from "@/ui/docs/DocsPage";
import { ScoreHud } from "@/ui/ScoreHud";
import { ScorePopCanvas } from "@/ui/ScorePopCanvas";

export default function App() {
  const isConverter = window.location.pathname === "/converter";
  const isDocs = window.location.pathname === "/docs";

  if (isConverter) {
    return <GltfConverter />;
  }

  if (isDocs) {
    return <DocsPage />;
  }

  return <GameApp />;
}

function GameApp() {
  useSettingsVersion();
  const [levaHidden, setLevaHidden] = useState(false);

  useEffect(() => {
    preloadSounds();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === "d") {
        e.preventDefault();
        setLevaHidden((h) => !h);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const backgroundColor = getActiveBackground();
  const initialCameraPosition =
    SETTINGS.camera.mode === "follow"
      ? SETTINGS.camera.follow.offset
      : SETTINGS.camera.static.position;

  return (
    <div
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        background: backgroundColor,
        cursor: "none",
      }}
    >
      <Leva collapsed hidden={levaHidden} />
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
      <CursorTrailCanvas />
      <ScorePopCanvas />
    </div>
  );
}
