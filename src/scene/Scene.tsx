import { BalloonLifecycleRuntime } from "@/gameplay/BalloonLifecycleRuntime";
import { CameraSystemProvider } from "@/camera/CameraSystem";
import { BenchmarkDebugContent } from "@/debug/BenchmarkDebugContent";
import { CameraFrustumOverlay } from "@/debug/CameraFrustumOverlay";
import { DebugCameraPiP } from "@/debug/DebugCameraPiP";
import { ContagionRuntime } from "@/gameplay/ContagionRuntime";
import { useGameplayStore } from "@/gameplay/gameplayStore";
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
import { useCallback, useEffect, useRef, useState } from "react";
import { useThree } from "@react-three/fiber";
import { CubeElement } from "@/primitives/CubeElement";
import { Balloon32 } from "@/assets/models/Balloon32";
import { Balloon28 } from "@/assets/models/Balloon28";
import { Balloon24 } from "@/assets/models/Balloon24";
import { Balloon20 } from "@/assets/models/Balloon20";
import { Balloon16 } from "@/assets/models/Balloon16";
import { Balloon12 } from "@/assets/models/Balloon12";
import { BalloonGroup } from "@/geometry/BalloonGroup";

type ActiveBalloon = {
  id: string;
  position: [number, number, number];
};

export function Scene() {
  useSettingsVersion();
  const playerRef = useRef<PlayerHandle | null>(null);
  const isDebug = SETTINGS.debug.enabled;
  const gameOver = useGameplayStore((state) => state.gameOver);
  const [activeBalloons, setActiveBalloons] = useState<ActiveBalloon[]>([
    { id: "balloon-1", position: [0, 1.3, 0] },
  ]);

  // Calculate the diagonal of the viewport to ensure the floor covers the entire screen
  const { viewport } = useThree();
  const diaginalRadiusOffset = 0.5;
  const diagonalRadius = Math.hypot(viewport.height, viewport.width) / 2 + diaginalRadiusOffset;
  const removeBalloonById = useCallback((id: string) => {
    setActiveBalloons((items) => items.filter((item) => item.id !== id));
  }, []);

  useEffect(() => {
    if (!gameOver) return;
    setActiveBalloons([]);
  }, [gameOver]);


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
            <BalloonLifecycleRuntime>
              {/* SPELAREN */}
              {/* <Player
                contagionCarrier
                contagionColor={8}
                position={[-1.4, 0.4, 0.4]}
              /> */}

              {/* CAMERA TRACKER */}
              <TransformMotion positionVelocity={{ z: 0 }}>
                <BlockElement ref={playerRef} hidden />
                <CubeElement position={[0, .0125, -diagonalRadius]} size={[5, .025, .025]} />
                <CubeElement position={[0, .0125, diagonalRadius]} size={[5, .025, .025]} />
              </TransformMotion>

              {/* BALLOON */}
              {activeBalloons.map((balloon) => (
                <BalloonGroup
                  key={balloon.id}
                  position={balloon.position}
                  onCleanupRequested={() => removeBalloonById(balloon.id)}
                />
              ))}

              <BlockElement color={1} position={[0, 0, 0]} sizePreset="sm" heightPreset="sm" physics="dynamic" contagionInfectable />
              <BlockElement color={1} position={[0, 0.21, 0]} sizePreset="sm" heightPreset="sm" physics="dynamic" contagionInfectable />
              <BlockElement color={1} position={[.1, 0, 0]} sizePreset="sm" heightPreset="sm" physics="dynamic" contagionInfectable />
              <BlockElement color={1} position={[.1, 0.21, 0]} sizePreset="sm" heightPreset="sm" physics="dynamic" contagionInfectable />
              <BlockElement color={1} position={[.2, 0, 0]} sizePreset="sm" heightPreset="sm" physics="dynamic" contagionInfectable />
              <BlockElement color={1} position={[.2, 0.21, 0]} sizePreset="sm" heightPreset="sm" physics="dynamic" contagionInfectable />
              <BlockElement color={1} position={[.3, 0, 0]} sizePreset="sm" heightPreset="sm" physics="dynamic" contagionInfectable />
              <BlockElement color={1} position={[.3, 0.21, 0]} sizePreset="sm" heightPreset="sm" physics="dynamic" contagionInfectable />
              <BlockElement color={1} position={[0, 0, .15]} sizePreset="sm" heightPreset="sm" physics="dynamic" contagionInfectable />
              <BlockElement color={1} position={[0, 0.21, .15]} sizePreset="sm" heightPreset="sm" physics="dynamic" contagionInfectable />
              <BlockElement color={1} position={[.1, 0, .15]} sizePreset="sm" heightPreset="sm" physics="dynamic" contagionInfectable />
              <BlockElement color={1} position={[.1, 0.21, .15]} sizePreset="sm" heightPreset="sm" physics="dynamic" contagionInfectable />
              <BlockElement color={1} position={[.2, 0, .15]} sizePreset="sm" heightPreset="sm" physics="dynamic" contagionInfectable />
              <BlockElement color={1} position={[.2, 0.21, .15]} sizePreset="sm" heightPreset="sm" physics="dynamic" contagionInfectable />
              <BlockElement color={1} position={[.3, 0, .15]} sizePreset="sm" heightPreset="sm" physics="dynamic" contagionInfectable />
              <BlockElement color={1} position={[.3, 0.21, .15]} sizePreset="sm" heightPreset="sm" physics="dynamic" contagionInfectable />



            {/* ENDLESS TILED LEVELS */}
            {/* <LevelTileManager /> */}

            {/* <ItemSpawner> */}
            {/* <BallBalloon animation="moving" />
              <BrickBalloon animation="moving" /> */}
            {/* <BlockElement /> */}
            {/* </ItemSpawner> */}

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
            </BalloonLifecycleRuntime>
          </MotionSystemProvider>
        </CameraSystemProvider>
      </Physics>

      {/* Debug: FPS / MS / MB overlay */}
      {isDebug && SETTINGS.debug.showStats && <Stats />}
    </GameKeyboardControls>
  );
}
