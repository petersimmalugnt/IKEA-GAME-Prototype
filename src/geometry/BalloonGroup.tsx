import * as THREE from 'three'
import { Balloon12 } from "@/assets/models/Balloon12";
import { Balloon16 } from "@/assets/models/Balloon16";
import { Balloon20 } from "@/assets/models/Balloon20";
import { Balloon24 } from "@/assets/models/Balloon24";
import { Balloon28 } from "@/assets/models/Balloon28";
import { Balloon32 } from "@/assets/models/Balloon32";
import { useBalloonLifecycleRegistry } from "@/gameplay/BalloonLifecycleRuntime";
import { useGameplayStore } from "@/gameplay/gameplayStore";
import { BlockElement } from "@/primitives/BlockElement";
import { SplineElement } from "@/primitives/SplineElement";
import { TransformMotion, type TransformMotionHandle } from "@/scene/TransformMotion";
import { SETTINGS, type MaterialColorIndex, type Vec3 } from "@/settings/GameSettings";
import type { ThreeElements } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type BalloonDetailLevel = "ultra" | "high" | "medium" | "low" | "veryLow" | "minimal";

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
    paused?: boolean;
    onPopped?: () => void;
    onMissed?: () => void;
    onCleanupRequested?: () => void;
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

const WRAP_WIDTH = 0.05;
const WRAP_DEPTH = 0.2;
const WRAP_BLOCK_HEIGHT = 0.1;
const WRAP_Y = -0.3;
const WRAP_OFFSET = 0.0025;
const WRAP_SIDE_X = WRAP_WIDTH / 2 + WRAP_OFFSET;
const WRAP_SIDE_Z = WRAP_DEPTH / 2 + WRAP_OFFSET;
const WRAP_TOP_Y = WRAP_Y + WRAP_OFFSET;
const WRAP_BOTTOM_Y = WRAP_Y - WRAP_BLOCK_HEIGHT - WRAP_OFFSET;
const VECTOR_EPSILON = 1e-6;
const POP_FALLBACK_LINEAR_VELOCITY: Vec3 = [0, 0, 0.2];
const POP_FALLBACK_ANGULAR_VELOCITY: Vec3 = [0.2327, 0.4596, 0.2327];
const DEFAULT_POP_RELEASE_TUNING: ResolvedBalloonPopReleaseTuning = {
    linearScale: 1.5,
    angularScale: 10,
    directionalBoost: 0.05,
    spinBoost: 0.18,
    linearDamping: 0.45,
    angularDamping: 1.0,
};

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

function resolveClampedNumber(value: number | undefined, fallback: number, min: number, max: number): number {
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
    const length = Math.sqrt((value[0] * value[0]) + (value[1] * value[1]) + (value[2] * value[2]));
    if (length <= VECTOR_EPSILON) return null;

    const invLength = 1 / length;
    return [value[0] * invLength, value[1] * invLength, value[2] * invLength];
}

const FALLBACK_LINEAR_DIRECTION: Vec3 = normalizeVec3(POP_FALLBACK_LINEAR_VELOCITY) ?? [0, 0, 1];
const FALLBACK_ANGULAR_DIRECTION: Vec3 = normalizeVec3(POP_FALLBACK_ANGULAR_VELOCITY) ?? [0, 1, 0];

function createFallbackPopRelease(): PopRelease {
    return {
        linearVelocity: cloneVec3(POP_FALLBACK_LINEAR_VELOCITY),
        angularVelocity: cloneVec3(POP_FALLBACK_ANGULAR_VELOCITY),
    };
}

function resolvePopReleaseTuning(input: BalloonPopReleaseTuning | undefined): ResolvedBalloonPopReleaseTuning {
    return {
        linearScale: resolveClampedNumber(input?.linearScale, DEFAULT_POP_RELEASE_TUNING.linearScale, 0, 4),
        angularScale: resolveClampedNumber(input?.angularScale, DEFAULT_POP_RELEASE_TUNING.angularScale, 0, 6),
        directionalBoost: resolveClampedNumber(input?.directionalBoost, DEFAULT_POP_RELEASE_TUNING.directionalBoost, 0, 2),
        spinBoost: resolveClampedNumber(input?.spinBoost, DEFAULT_POP_RELEASE_TUNING.spinBoost, 0, 8),
        linearDamping: resolveClampedNumber(input?.linearDamping, DEFAULT_POP_RELEASE_TUNING.linearDamping, 0, 10),
        angularDamping: resolveClampedNumber(input?.angularDamping, DEFAULT_POP_RELEASE_TUNING.angularDamping, 0, 10),
    };
}

export function BalloonGroup({
    detailLevel = "ultra",
    color = 8,
    paused = false,
    onPopped,
    onMissed,
    onCleanupRequested,
    popReleaseTuning,
    ...props
}: BalloonGroupProps) {
    const BalloonComponent = BALLOONS[detailLevel];
    const [popped, setPopped] = useState(false);
    const poppedRef = useRef(false);
    const motionRef = useRef<TransformMotionHandle | null>(null);
    const probeRef = useRef<THREE.Group | null>(null);
    const popReleaseRef = useRef<PopRelease | null>(null);
    const probeWorld = useMemo(() => new THREE.Vector3(), []);
    const lifecycleRegistry = useBalloonLifecycleRegistry();
    const gameOver = useGameplayStore((state) => state.gameOver);
    const tuning = resolvePopReleaseTuning(popReleaseTuning);
    const motionPaused = paused || popped || gameOver;

    const getWorldXZ = useCallback(() => {
        const probe = probeRef.current;
        if (!probe) return undefined;
        probe.getWorldPosition(probeWorld);
        return {
            x: probeWorld.x,
            z: probeWorld.z,
        };
    }, [probeWorld]);

    const isPopped = useCallback(() => poppedRef.current, []);

    const handleMissed = useCallback(() => {
        onMissed?.();
    }, [onMissed]);

    const handleCleanupRequested = useCallback(() => {
        onCleanupRequested?.();
    }, [onCleanupRequested]);

    useEffect(() => {
        if (!lifecycleRegistry) return;
        return lifecycleRegistry.register({
            getWorldXZ,
            isPopped,
            onMissed: handleMissed,
            onCleanupRequested: handleCleanupRequested,
        });
    }, [lifecycleRegistry, getWorldXZ, isPopped, handleMissed, handleCleanupRequested]);

    const handleBalloonPointerDown: ThreeElements["group"]["onPointerDown"] = (event) => {
        if (gameOver) return;
        if (poppedRef.current) return;
        if (event.pointerType === "mouse" && event.button !== 0) return;

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

            const scaledLinear = scaleVec3(baseRelease.linearVelocity, tuning.linearScale);
            const scaledAngular = scaleVec3(baseRelease.angularVelocity, tuning.angularScale);
            const direction = normalizeVec3(scaledLinear) ?? FALLBACK_LINEAR_DIRECTION;
            const spinDirection = normalizeVec3(scaledAngular) ?? FALLBACK_ANGULAR_DIRECTION;

            popReleaseRef.current = {
                linearVelocity: addVec3(scaledLinear, scaleVec3(direction, tuning.directionalBoost)),
                angularVelocity: addVec3(scaledAngular, scaleVec3(spinDirection, tuning.spinBoost)),
            };
        }

        useGameplayStore.getState().addScore(SETTINGS.gameplay.balloons.scorePerPop);
        setPopped(true);
        onPopped?.();
    };
    const popRelease = popReleaseRef.current;

    return (
        <TransformMotion
            ref={motionRef}
            paused={motionPaused}
            positionVelocity={{ z: 0.2 }}
            rotationVelocity={{ x: 13.3333, y: 26.3333, z: 13.3333 }}
            rotationEasing={{ x: "easeInOutSine", y: "linear", z: "easeInOutSine" }}
            rotationLoopMode={{ x: "pingpong", y: "loop", z: "pingpong" }}
            rotationRange={{ x: [-10, 10], y: [0, 360], z: [-10, 10] }}
            rotationRangeStart={{ x: 0, y: 0, z: 0.5 }}
            {...props}
        >
            <group ref={probeRef}>
                {!popped ? (
                    <>
                        <BalloonComponent
                            materialColor0={color}
                            onPointerDown={handleBalloonPointerDown}
                        />
                        <SplineElement points={[[0, 0, 0], [0, WRAP_TOP_Y, 0]]} segments={1} />
                        <SplineElement
                            points={WRAP_POINTS}
                            segments={1}
                            curveType="linear"
                            castShadow={false}
                        />
                    </>
                ) : null}
                <BlockElement
                    position={[0, -0.3, 0]}
                    sizePreset="sm"
                    heightPreset="sm"
                    color={color}
                    align={{ x: 50, y: 100, z: 50 }}
                    plane="z"
                    physics={popped ? "dynamic" : undefined}
                    contagionCarrier={popped}
                    contagionColor={color}
                    linearVelocity={popped ? popRelease?.linearVelocity : undefined}
                    angularVelocity={popped ? popRelease?.angularVelocity : undefined}
                    linearDamping={popped ? tuning.linearDamping : undefined}
                    angularDamping={popped ? tuning.angularDamping : undefined}
                />
            </group>
        </TransformMotion>
    );
}
