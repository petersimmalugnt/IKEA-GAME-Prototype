import { CameraSystemProvider } from "@/camera/CameraSystem";
import { BenchmarkDebugContent } from "@/debug/BenchmarkDebugContent";
import { CameraFrustumOverlay } from "@/debug/CameraFrustumOverlay";
import { DebugCameraPiP } from "@/debug/DebugCameraPiP";
import { ContagionRuntime } from "@/gameplay/ContagionRuntime";
import { ItemSpawner } from "@/gameplay/ItemSpawner";
import { ExternalControlBridge } from "@/input/control/ExternalControlBridge";
import { GameKeyboardControls } from "@/input/GameKeyboardControls";
import { LevelTileManager } from "@/levels/LevelTileManager";
import { LiveLevelSync } from "@/LiveLevelSync";
import { BlockElement } from "@/primitives/BlockElement";
import { InvisibleFloor } from "@/primitives/InvisibleFloor";
import { GameEffects } from "@/render/Effects";
import { Player, type PlayerHandle } from "@/scene/Player";
import { MotionSystemProvider, TransformMotion } from "@/scene/TransformMotion";
import { SETTINGS } from "@/settings/GameSettings";
import { useSettingsVersion } from "@/settings/settingsStore";
import { Stats } from "@react-three/drei";
import { Physics } from "@react-three/rapier";
import { useRef } from "react";

export function Scene() {
  useSettingsVersion();
  const playerRef = useRef<PlayerHandle | null>(null);
  const isDebug = SETTINGS.debug.enabled;

  return (
    <GameKeyboardControls>
      <ExternalControlBridge />
      <LiveLevelSync />
      <Physics
        gravity={[0, -9.81, 0]}
        debug={isDebug && SETTINGS.debug.showColliders}
      >
        <ContagionRuntime />
        <GameEffects />
        <CameraSystemProvider playerRef={playerRef}>
          <MotionSystemProvider>
            {/* SPELAREN */}
            <Player
              contagionCarrier
              contagionColor={8}
              position={[-1.4, 0.4, 0.4]}
            />
            <TransformMotion positionVelocity={{ z: -0.5 }}>
              <BlockElement ref={playerRef} hidden />
            </TransformMotion>
            {/* ENDLESS TILED LEVELS */}
            <LevelTileManager />

            {/* ITEM SPAWNER (top/right spawn, left/bottom cull) */}
            <ItemSpawner />

            {/* DEBUG BENCHMARK + STREAMING */}
            <BenchmarkDebugContent />
            {(isDebug && SETTINGS.debug.showCameraFrustum) ||
            (isDebug && SETTINGS.debug.showDebugCamera) ? (
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
  );
}
