import { useLevelStore } from "@/levelStore";
import { SETTINGS } from "@/settings/GameSettings";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import * as THREE from "three";

const DEFAULT_UNIT_SIZE = 0.1;
const DEFAULT_GRID_SIZE: [number, number] = [128, 128];

// InvisibleFloor — inkluderar statisk fysik-collider för golvet
export function InvisibleFloor({
  shadowColor = SETTINGS.colors.shadow,
}: {
  shadowColor?: string;
}) {
  const levelData = useLevelStore((s) => s.levelData);
  const unitSize = levelData?.unitSize ?? DEFAULT_UNIT_SIZE;
  const gridSize = levelData?.gridSize ?? DEFAULT_GRID_SIZE;
  const size = Math.max(gridSize[0], gridSize[1]) * unitSize;
  const divisions = Math.max(gridSize[0], gridSize[1]);

  return (
    <group position={[0, 0, 0]}>
      <RigidBody type="fixed">
        <CuboidCollider args={[50, 0.01, 50]} position={[0, -0.01, 0]} />
      </RigidBody>

      <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={-1}>
        <planeGeometry args={[100, 100]} />
        <meshBasicMaterial colorWrite={false} depthWrite />
      </mesh>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.001, 0]}
        receiveShadow
      >
        <planeGeometry args={[100, 100]} />
        <shadowMaterial
          color={shadowColor}
          opacity={1}
          blending={THREE.NormalBlending}
        />
      </mesh>

      {SETTINGS.debug.enabled && SETTINGS.debug.showGrid && (
        <gridHelper
          args={[size, divisions, "#888888", "#444444"]}
          position={[0, 0.002, 0]}
        />
      )}
    </group>
  );
}
