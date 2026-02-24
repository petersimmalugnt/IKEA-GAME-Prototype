import { Balloon } from "@/assets/models/Balloon";
import { Balloon2 } from "@/assets/models/Balloon2";
import { Balloon3 } from "@/assets/models/Balloon3";
import { CameraSystemProvider } from "@/camera/CameraSystem";
import { ContagionRuntime } from "@/gameplay/ContagionRuntime";
import { ItemSpawner } from "@/gameplay/ItemSpawner";
import { ExternalControlBridge } from "@/input/control/ExternalControlBridge";
import { GameKeyboardControls } from "@/input/GameKeyboardControls";
import { LevelTileManager } from "@/levels/LevelTileManager";
import { LiveLevelSync } from "@/LiveLevelSync";
import { BlockElement } from "@/primitives/BlockElement";
import { CubeElement } from "@/primitives/CubeElement";
import { InvisibleFloor } from "@/primitives/InvisibleFloor";
import { SplineElement } from "@/primitives/SplineElement";
import { GameEffects } from "@/render/Effects";
import { GameLights } from "@/render/Lights";
import { type PlayerHandle } from "@/scene/Player";
import type { PositionTargetHandle } from "@/scene/PositionTargetHandle";
import { MotionSystemProvider, TransformMotion } from "@/scene/TransformMotion";
import { SETTINGS } from "@/settings/GameSettings";
import { useSettingsVersion } from "@/settings/settingsStore";
import { Stats } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import { useRef } from "react";
import * as THREE from "three";

export function Scene() {
  useSettingsVersion();
  const playerRef = useRef<PlayerHandle | null>(null);
  const directionalLightRef = useRef<THREE.DirectionalLight | null>(null);
  const spawnMarkerRef = useRef<PositionTargetHandle | null>(null);
  const cullMarkerRef = useRef<PositionTargetHandle | null>(null);
  const isDebug = SETTINGS.debug.enabled;

  // Calculate the diagonal of the viewport to ensure the floor covers the entire screen
  const { viewport } = useThree();
  const diaginalRadiusOffset = -0.5;
  const diagonalRadius =
    Math.hypot(viewport.height, viewport.width) / 2 + diaginalRadiusOffset;

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
        <GameLights lightRef={directionalLightRef} />
        <CameraSystemProvider
          playerRef={playerRef}
          directionalLightRef={directionalLightRef}
        >
          <MotionSystemProvider>
            {/* SPELAREN */}
            {/* <Player
              contagionCarrier
              contagionColor={8}
              position={[-1.4, 0.4, 0.4]}
            /> */}

            {/* CAMERA TRACKER */}
            <TransformMotion positionVelocity={{ z: -0.5 }}>
              {/* Diagonal positions blocks */}
              {/* Create */}
              <CubeElement
                ref={spawnMarkerRef}
                position={[0, 0.0125, -diagonalRadius]}
                size={[5, 0.025, 0.025]}
              />
              {/* Cull */}
              <CubeElement
                ref={cullMarkerRef}
                position={[0, 0.0125, diagonalRadius]}
                size={[5, 0.025, 0.025]}
              />
              <BlockElement ref={playerRef} hidden />
            </TransformMotion>

            {/* BALLOON */}
            <TransformMotion
              position={[0, 1.3, 0]}
              positionVelocity={{ z: 0.2 }}
              rotationVelocity={{ x: 13.3333, y: 26.3333, z: 13.3333 }}
              rotationEasing={{
                x: "easeInOutSine",
                y: "linear",
                z: "easeInOutSine",
              }}
              rotationLoopMode={{ x: "pingpong", y: "loop", z: "pingpong" }}
              rotationRange={{ x: [-10, 10], y: [0, 360], z: [-10, 10] }}
              rotationRangeStart={{ x: 0, y: 0, z: 0.5 }}
            >
              <Balloon materialColor0={8} />
              <SplineElement
                points={[
                  [0, -0.3, 0],
                  [0, 0, 0],
                ]}
                segments={1}
              />
              <BlockElement
                position={[0, -0.3, 0]}
                sizePreset="sm"
                heightPreset="sm"
                color={2}
                align={{ x: 50, y: 100, z: 50 }}
                plane="z"
              />
            </TransformMotion>

            <TransformMotion
              position={[-0.5, 1.3, 0]}
              positionVelocity={{ z: 0.2 }}
              rotationVelocity={{ x: 13.3333, y: 26.3333, z: 13.3333 }}
              rotationEasing={{
                x: "easeInOutSine",
                y: "linear",
                z: "easeInOutSine",
              }}
              rotationLoopMode={{ x: "pingpong", y: "loop", z: "pingpong" }}
              rotationRange={{ x: [-10, 10], y: [0, 360], z: [-10, 10] }}
              rotationRangeStart={{ x: 0, y: 0, z: 0.5 }}
            >
              <Balloon2 materialColor0={8} />
              <SplineElement
                points={[
                  [0, -0.3, 0],
                  [0, 0, 0],
                ]}
                segments={1}
              />
              <BlockElement
                position={[0, -0.3, 0]}
                sizePreset="sm"
                heightPreset="sm"
                color={2}
                align={{ x: 50, y: 100, z: 50 }}
                plane="z"
              />
            </TransformMotion>

            <TransformMotion
              position={[-1, 1.3, 0]}
              positionVelocity={{ z: 0.2 }}
              rotationVelocity={{ x: 13.3333, y: 26.3333, z: 13.3333 }}
              rotationEasing={{
                x: "easeInOutSine",
                y: "linear",
                z: "easeInOutSine",
              }}
              rotationLoopMode={{ x: "pingpong", y: "loop", z: "pingpong" }}
              rotationRange={{ x: [-10, 10], y: [0, 360], z: [-10, 10] }}
              rotationRangeStart={{ x: 0, y: 0, z: 0.5 }}
            >
              <Balloon3 materialColor0={8} />
              <SplineElement
                points={[
                  [0, -0.3, 0],
                  [0, 0, 0],
                ]}
                segments={1}
              />
              <BlockElement
                position={[0, -0.3, 0]}
                sizePreset="sm"
                heightPreset="sm"
                color={2}
                align={{ x: 50, y: 100, z: 50 }}
                plane="z"
              />
            </TransformMotion>

            {/* ENDLESS TILED LEVELS */}
            <LevelTileManager />

            {/* ITEM SPAWNER */}
            <ItemSpawner
              spawnMarkerRef={spawnMarkerRef}
              cullMarkerRef={cullMarkerRef}
            >
              <Balloon />
              <Balloon2 />
              <Balloon3 />
            </ItemSpawner>

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
