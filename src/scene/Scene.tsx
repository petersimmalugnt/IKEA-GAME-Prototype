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
import { SplineElement } from "@/primitives/SplineElement";
import { BallBalloon } from "@/assets/models/BallBalloon";
import { BrickBalloon } from "@/assets/models/BrickBalloon";
import { GridCloner } from "@/scene/GridCloner";
import { LevelRenderer } from "@/LevelRenderer";
import { GameEffects } from "@/render/Effects";
import { Player, type PlayerHandle } from "@/scene/Player";
import { MotionSystemProvider, TransformMotion } from "@/scene/TransformMotion";
import { SETTINGS } from "@/settings/GameSettings";
import { useSettingsVersion } from "@/settings/settingsStore";
import { Stats } from "@react-three/drei";
import { Physics } from "@react-three/rapier";
import { useRef } from "react";
import { useThree } from "@react-three/fiber";
import { CubeElement } from "@/primitives/CubeElement";
import { Balloon } from "@/assets/models/Balloon";


export function Scene() {
  useSettingsVersion();
  const playerRef = useRef<PlayerHandle | null>(null);
  const isDebug = SETTINGS.debug.enabled;

  // Calculate the diagonal of the viewport to ensure the floor covers the entire screen
  const { viewport } = useThree();
  const diagonal = Math.hypot(viewport.height, viewport.width) + 1.33;

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
            {/* <Player
              contagionCarrier
              contagionColor={8}
              position={[-1.4, 0.4, 0.4]}
            /> */}

            <CubeElement position={[0, .0125, diagonal * -.5]} size={[5, .025, .025]} />

            <TransformMotion positionVelocity={{ z: 0 }}>
              <BlockElement ref={playerRef} hidden />
            </TransformMotion>

            {/* ENDLESS TILED LEVELS */}
            {/* <LevelTileManager /> */}

            {/* <ItemSpawner> */}
            {/* <BallBalloon animation="moving" />
              <BrickBalloon animation="moving" /> */}
            {/* <BlockElement /> */}
            {/* </ItemSpawner> */}


            <TransformMotion position={[0, 1.3, 0]} rotationVelocity={{ x: 13.3333, y: 26.3333, z: 13.3333 }} rotationEasing={{ x: 'easeInOutSine', y: 'linear', z: 'easeInOutSine' }} rotationLoopMode={{ x: 'pingpong', y: 'loop', z: 'pingpong' }} rotationRange={{ x: [-10, 10], y: [0, 360], z: [-10, 10] }} rotationRangeStart={{ x: 0, y: 0, z: 0.5 }}>
              <Balloon materialColor0={8} />
              <SplineElement points={[[0, -.3, 0], [0, 0, 0]]} segments={1} />
              <BlockElement position={[0, -0.3, 0]} sizePreset="sm" heightPreset="sm" color={2} align={{ x: 50, y: 100, z: 50 }} plane="z" />
            </TransformMotion>

            {/* LEVEL FROM STORE (file or live sync) */}
            {/* <LevelRenderer /> */}


            {/* DEBUG BENCHMARK + STREAMING */}
            {/* <BenchmarkDebugContent />
            {(isDebug && SETTINGS.debug.showCameraFrustum) ||
              (isDebug && SETTINGS.debug.showDebugCamera) ? (
              <CameraFrustumOverlay />
            ) : null}
            {isDebug && SETTINGS.debug.showDebugCamera && <DebugCameraPiP />} */}

            <InvisibleFloor />
          </MotionSystemProvider>
        </CameraSystemProvider>
      </Physics>

      {/* Debug: FPS / MS / MB overlay */}
      {isDebug && SETTINGS.debug.showStats && <Stats />}
    </GameKeyboardControls>
  );
}
