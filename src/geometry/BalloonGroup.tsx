import { Balloon12 } from "@/assets/models/Balloon12";
import { Balloon16 } from "@/assets/models/Balloon16";
import { Balloon20 } from "@/assets/models/Balloon20";
import { Balloon24 } from "@/assets/models/Balloon24";
import { Balloon28 } from "@/assets/models/Balloon28";
import { Balloon32 } from "@/assets/models/Balloon32";
import { playFelt, playPop } from "@/audio/SoundManager";
import { useBalloonLifecycleRegistry } from "@/gameplay/BalloonLifecycleRuntime";
import { useGameplayStore } from "@/gameplay/gameplayStore";
import { getCursorVelocityPx } from "@/input/cursorVelocity";
import { emitScorePop } from "@/input/scorePopEmitter";
import { BlockElement } from "@/primitives/BlockElement";
import { SplineElement } from "@/primitives/SplineElement";
import type { PositionTargetHandle } from "@/scene/PositionTargetHandle";
import {
  TransformMotion,
  type TransformMotionHandle,
} from "@/scene/TransformMotion";
import {
  SETTINGS,
  getActivePalette,
  type MaterialColorIndex,
  type Vec3,
} from "@/settings/GameSettings";
import { useFrame, type ThreeElements } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

type BalloonDetailLevel =
  | "ultra"
  | "high"
  | "medium"
  | "low"
  | "veryLow"
  | "minimal";

export type BalloonPopReleaseTuning = {
  linearScale?: number;
  angularScale?: number;
  directionalBoost?: number;
  spinBoost?: number;
  linearDamping?: number;
  angularDamping?: number;
};

type ResolvedBalloonPopReleaseTuning = {
  linearScale: number;
  angularScale: number;
  directionalBoost: number;
  spinBoost: number;
  linearDamping: number;
  angularDamping: number;
};

type BalloonGroupProps = Omit<ThreeElements["group"], "ref"> & {
  detailLevel?: BalloonDetailLevel;
  color?: MaterialColorIndex;
  randomize?: boolean;
  paused?: boolean;
  onPopped?: () => void;
  onMissed?: () => void;
  onCleanupRequested?: () => void;
  /** Called once on mount; the provided getter returns the item's current world Z. Returns an unregister function. */
  onRegisterCullZ?: (getter: () => number | undefined) => () => void;
  popReleaseTuning?: BalloonPopReleaseTuning;
};

const BALLOONS = {
  ultra: Balloon32,
  high: Balloon28,
  medium: Balloon24,
  low: Balloon20,
  veryLow: Balloon16,
  minimal: Balloon12,
};

// Centrala BalloonGroup-inställningar: håll all gameplay-tuning här.
const BALLOON_GROUP_SETTINGS = {
  randomize: {
    excludedColorIndices: [0, 1, 2, 9] as number[],
    positionVelocityZBase: 0.5,
    positionVelocityZAmplitude: 0.2,
    rotationOffsetBase: 0,
    rotationOffsetAmplitude: 2.0,
  },
  motion: {
    positionVelocityZ: 0.2,
    rotationVelocity: { x: 13.3333, y: 26.3333, z: 13.3333 },
    rotationEasing: {
      x: "easeInOutSine" as const,
      y: "linear" as const,
      z: "easeInOutSine" as const,
    },
    rotationLoopMode: {
      x: "pingpong" as const,
      y: "loop" as const,
      z: "pingpong" as const,
    },
    rotationRange: {
      x: [-10, 10] as [number, number],
      y: [0, 360] as [number, number],
      z: [-10, 10] as [number, number],
    },
    rotationRangeStart: { x: 0, y: 0, z: 0.5 },
  },
  popRelease: {
    fallbackLinearVelocity: [0, 0, 0.2] as Vec3,
    fallbackAngularVelocity: [0.2327, 0.4596, 0.2327] as Vec3,
    defaultTuning: {
      linearScale: 1.5,
      angularScale: 10,
      directionalBoost: 0.05,
      spinBoost: 0.18,
      linearDamping: 0.45,
      angularDamping: 1.0,
    } as ResolvedBalloonPopReleaseTuning,
  },
  wrap: {
    width: 0.05,
    depth: 0.2,
    blockHeight: 0.1,
    y: -0.3,
    offset: 0.0025,
  },
};

const VECTOR_EPSILON = 1e-6;
const WRAP_SIDE_X =
  BALLOON_GROUP_SETTINGS.wrap.width / 2 + BALLOON_GROUP_SETTINGS.wrap.offset;
const WRAP_SIDE_Z =
  BALLOON_GROUP_SETTINGS.wrap.depth / 2 + BALLOON_GROUP_SETTINGS.wrap.offset;
const WRAP_TOP_Y =
  BALLOON_GROUP_SETTINGS.wrap.y + BALLOON_GROUP_SETTINGS.wrap.offset;
const WRAP_BOTTOM_Y =
  BALLOON_GROUP_SETTINGS.wrap.y -
  BALLOON_GROUP_SETTINGS.wrap.blockHeight -
  BALLOON_GROUP_SETTINGS.wrap.offset;

// Manual values keep wrap generation fast and isolated to BalloonGroup.
const WRAP_POINTS: [number, number, number][] = [
  [0, WRAP_TOP_Y, 0],
  [WRAP_SIDE_X, WRAP_TOP_Y, 0],
  [WRAP_SIDE_X, WRAP_BOTTOM_Y, 0],
  [-WRAP_SIDE_X, WRAP_BOTTOM_Y, 0],
  [-WRAP_SIDE_X, WRAP_TOP_Y, 0],
  [0, WRAP_TOP_Y, 0],
  [0, WRAP_TOP_Y, WRAP_SIDE_Z],
  [0, WRAP_BOTTOM_Y, WRAP_SIDE_Z],
  [0, WRAP_BOTTOM_Y, -WRAP_SIDE_Z],
  [0, WRAP_TOP_Y, -WRAP_SIDE_Z],
  [0, WRAP_TOP_Y, 0],
];

type PopRelease = {
  linearVelocity: Vec3;
  angularVelocity: Vec3;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function resolveClampedNumber(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return clamp(value, min, max);
}

function cloneVec3(value: Vec3): Vec3 {
  return [value[0], value[1], value[2]];
}

function scaleVec3(value: Vec3, scalar: number): Vec3 {
  return [value[0] * scalar, value[1] * scalar, value[2] * scalar];
}

function addVec3(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function normalizeVec3(value: Vec3): Vec3 | null {
  const length = Math.sqrt(
    value[0] * value[0] + value[1] * value[1] + value[2] * value[2],
  );
  if (length <= VECTOR_EPSILON) return null;

  const invLength = 1 / length;
  return [value[0] * invLength, value[1] * invLength, value[2] * invLength];
}

const FALLBACK_LINEAR_DIRECTION: Vec3 = normalizeVec3(
  BALLOON_GROUP_SETTINGS.popRelease.fallbackLinearVelocity,
) ?? [0, 0, 1];
const FALLBACK_ANGULAR_DIRECTION: Vec3 = normalizeVec3(
  BALLOON_GROUP_SETTINGS.popRelease.fallbackAngularVelocity,
) ?? [0, 1, 0];

function createFallbackPopRelease(): PopRelease {
  return {
    linearVelocity: cloneVec3(
      BALLOON_GROUP_SETTINGS.popRelease.fallbackLinearVelocity,
    ),
    angularVelocity: cloneVec3(
      BALLOON_GROUP_SETTINGS.popRelease.fallbackAngularVelocity,
    ),
  };
}

function resolvePopReleaseTuning(
  input: BalloonPopReleaseTuning | undefined,
): ResolvedBalloonPopReleaseTuning {
  return {
    linearScale: resolveClampedNumber(
      input?.linearScale,
      BALLOON_GROUP_SETTINGS.popRelease.defaultTuning.linearScale,
      0,
      4,
    ),
    angularScale: resolveClampedNumber(
      input?.angularScale,
      BALLOON_GROUP_SETTINGS.popRelease.defaultTuning.angularScale,
      0,
      6,
    ),
    directionalBoost: resolveClampedNumber(
      input?.directionalBoost,
      BALLOON_GROUP_SETTINGS.popRelease.defaultTuning.directionalBoost,
      0,
      2,
    ),
    spinBoost: resolveClampedNumber(
      input?.spinBoost,
      BALLOON_GROUP_SETTINGS.popRelease.defaultTuning.spinBoost,
      0,
      8,
    ),
    linearDamping: resolveClampedNumber(
      input?.linearDamping,
      BALLOON_GROUP_SETTINGS.popRelease.defaultTuning.linearDamping,
      0,
      10,
    ),
    angularDamping: resolveClampedNumber(
      input?.angularDamping,
      BALLOON_GROUP_SETTINGS.popRelease.defaultTuning.angularDamping,
      0,
      10,
    ),
  };
}

function pickRandomBalloonColorIndex(
  fallback: MaterialColorIndex,
): MaterialColorIndex {
  const paletteSize = getActivePalette().colors.length;
  if (paletteSize <= 0) return fallback;

  const candidates: number[] = [];
  for (let i = 0; i < paletteSize; i += 1) {
    if (!BALLOON_GROUP_SETTINGS.randomize.excludedColorIndices.includes(i)) {
      candidates.push(i);
    }
  }
  const samplePoolSize =
    candidates.length > 0 ? candidates.length : paletteSize;
  const randomIndex = Math.floor(Math.random() * samplePoolSize);

  if (candidates.length > 0) {
    return candidates[randomIndex] ?? fallback;
  }
  return randomIndex;
}

export function BalloonGroup({
  detailLevel = "ultra",
  color = 8,
  randomize = false,
  paused = false,
  onPopped,
  onMissed,
  onCleanupRequested: _onCleanupRequested,
  onRegisterCullZ,
  popReleaseTuning,
  ...props
}: BalloonGroupProps) {
  const BalloonComponent = BALLOONS[detailLevel];
  const [popped, setPopped] = useState(false);
  const poppedRef = useRef(false);
  const motionRef = useRef<TransformMotionHandle | null>(null);
  const probeRef = useRef<THREE.Group | null>(null);
  const blockRef = useRef<PositionTargetHandle | null>(null);
  const popReleaseRef = useRef<PopRelease | null>(null);
  const feltPlayedRef = useRef(false);
  const randomColorRef = useRef<MaterialColorIndex | null>(null);
  const probeWorld = useMemo(() => new THREE.Vector3(), []);
  const lifecycleRegistry = useBalloonLifecycleRegistry();
  const gameOver = useGameplayStore((state) => state.gameOver);
  const tuning = resolvePopReleaseTuning(popReleaseTuning);
  const motionPaused = paused || popped || gameOver;
  if (randomize && randomColorRef.current === null) {
    randomColorRef.current = pickRandomBalloonColorIndex(color);
  }
  const resolvedColor = randomize ? (randomColorRef.current ?? color) : color;

  const getWorldXZ = useCallback(() => {
    if (poppedRef.current) {
      const pos = blockRef.current?.getPosition();
      if (!pos) return undefined;
      return { x: pos.x, z: pos.z };
    }
    const probe = probeRef.current;
    if (!probe) return undefined;
    probe.getWorldPosition(probeWorld);
    return { x: probeWorld.x, z: probeWorld.z };
  }, [probeWorld]);

  const isPopped = useCallback(() => poppedRef.current, []);

  const handleMissed = useCallback(() => {
    onMissed?.();
  }, [onMissed]);

  useEffect(() => {
    if (!lifecycleRegistry) return;
    return lifecycleRegistry.register({
      getWorldXZ,
      isPopped,
      onMissed: handleMissed,
    });
  }, [lifecycleRegistry, getWorldXZ, isPopped, handleMissed]);

  useEffect(() => {
    if (!onRegisterCullZ) return;
    return onRegisterCullZ(() => {
      if (poppedRef.current) return blockRef.current?.getPosition()?.z;
      const probe = probeRef.current;
      if (!probe) return undefined;
      probe.getWorldPosition(probeWorld);
      return probeWorld.z;
    });
  }, [onRegisterCullZ, probeWorld]);

  useFrame(() => {
    if (!popped || feltPlayedRef.current) return;
    const pos = blockRef.current?.getPosition();
    if (pos && pos.y < 0.05) {
      feltPlayedRef.current = true;
      playFelt();
    }
  });

  const handleBalloonPointerEnter: ThreeElements["group"]["onPointerEnter"] = (
    event,
  ) => {
    if (gameOver) return;
    if (poppedRef.current) return;

    if (event.pointerType === "mouse") {
      if (getCursorVelocityPx() < SETTINGS.cursor.minPopVelocity) return;
    }

    event.stopPropagation();
    poppedRef.current = true;

    if (!popReleaseRef.current) {
      const snapshot = motionRef.current?.getVelocitySnapshot();
      const baseRelease: PopRelease = snapshot
        ? {
          linearVelocity: cloneVec3(snapshot.linearVelocity),
          angularVelocity: cloneVec3(snapshot.angularVelocity),
        }
        : createFallbackPopRelease();

      const scaledLinear = scaleVec3(
        baseRelease.linearVelocity,
        tuning.linearScale,
      );
      const scaledAngular = scaleVec3(
        baseRelease.angularVelocity,
        tuning.angularScale,
      );
      const direction =
        normalizeVec3(scaledLinear) ?? FALLBACK_LINEAR_DIRECTION;
      const spinDirection =
        normalizeVec3(scaledAngular) ?? FALLBACK_ANGULAR_DIRECTION;

      popReleaseRef.current = {
        linearVelocity: addVec3(
          scaledLinear,
          scaleVec3(direction, tuning.directionalBoost),
        ),
        angularVelocity: addVec3(
          scaledAngular,
          scaleVec3(spinDirection, tuning.spinBoost),
        ),
      };
    }

    useGameplayStore
      .getState()
      .addScore(SETTINGS.gameplay.balloons.scorePerPop);
    const projected = event.point.clone().project(event.camera);
    emitScorePop({
      amount: SETTINGS.gameplay.balloons.scorePerPop,
      x: ((projected.x + 1) / 2) * window.innerWidth,
      y: ((-projected.y + 1) / 2) * window.innerHeight,
    });
    setPopped(true);
    playPop();
    onPopped?.();
  };
  const popRelease = popReleaseRef.current;

  return (
    <TransformMotion
      ref={motionRef}
      paused={motionPaused}
      positionVelocity={
        randomize
          ? { z: BALLOON_GROUP_SETTINGS.randomize.positionVelocityZBase }
          : { z: BALLOON_GROUP_SETTINGS.motion.positionVelocityZ }
      }
      randomPositionVelocity={
        randomize
          ? { z: BALLOON_GROUP_SETTINGS.randomize.positionVelocityZAmplitude }
          : undefined
      }
      rotationVelocity={BALLOON_GROUP_SETTINGS.motion.rotationVelocity}
      rotationEasing={BALLOON_GROUP_SETTINGS.motion.rotationEasing}
      rotationLoopMode={BALLOON_GROUP_SETTINGS.motion.rotationLoopMode}
      rotationRange={BALLOON_GROUP_SETTINGS.motion.rotationRange}
      rotationRangeStart={BALLOON_GROUP_SETTINGS.motion.rotationRangeStart}
      rotationOffset={
        randomize
          ? BALLOON_GROUP_SETTINGS.randomize.rotationOffsetBase
          : undefined
      }
      randomRotationOffset={
        randomize
          ? BALLOON_GROUP_SETTINGS.randomize.rotationOffsetAmplitude
          : undefined
      }
      timeScale={1.5}
      {...props}
    >
      <group ref={probeRef}>
        {!popped ? (
          <>
            <BalloonComponent
              materialColor0={resolvedColor}
              onPointerEnter={handleBalloonPointerEnter}
            />
            {/* Enlarged invisible hit sphere to catch fast cursor swipes */}
            <mesh
              onPointerEnter={handleBalloonPointerEnter}
              position={[0, 0.15, 0]}
            >
              <sphereGeometry args={[0.15, 5, 5]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
            <SplineElement
              points={[
                [0, 0, 0],
                [0, WRAP_TOP_Y, 0],
              ]}
              segments={1}
            />
            <SplineElement
              points={WRAP_POINTS}
              segments={1}
              curveType="linear"
              castShadow={false}
            />
          </>
        ) : null}
        <BlockElement
          ref={blockRef}
          position={[0, -0.3, 0]}
          sizePreset="sm"
          heightPreset="sm"
          color={resolvedColor}
          align={{ x: 50, y: 100, z: 50 }}
          plane="z"
          physics={popped ? "dynamic" : undefined}
          contagionCarrier={popped}
          contagionInfectable={false}
          contagionColor={resolvedColor}
          linearVelocity={popped ? popRelease?.linearVelocity : undefined}
          angularVelocity={popped ? popRelease?.angularVelocity : undefined}
          linearDamping={popped ? tuning.linearDamping : undefined}
          angularDamping={popped ? tuning.angularDamping : undefined}
          mass={popped ? 100 : undefined}
        />
      </group>
    </TransformMotion>
  );
}
