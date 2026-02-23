import { SETTINGS } from "@/settings/GameSettings";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import * as THREE from "three";

const FLOOR_HALF_EXTENT = 5000;
const FLOOR_SIZE = FLOOR_HALF_EXTENT * 2;

export function InvisibleFloor({
  shadowColor = SETTINGS.colors.shadow,
}: {
  shadowColor?: string;
}) {
  return (
    <group position={[0, 0, 0]}>
      <RigidBody type="fixed">
        <CuboidCollider args={[FLOOR_HALF_EXTENT, 0.01, FLOOR_HALF_EXTENT]} position={[0, -0.01, 0]} />
      </RigidBody>

      <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={-1}>
        <planeGeometry args={[FLOOR_SIZE, FLOOR_SIZE]} />
        <meshBasicMaterial colorWrite={false} depthWrite />
      </mesh>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.001, 0]}
        receiveShadow
      >
        <planeGeometry args={[FLOOR_SIZE, FLOOR_SIZE]} />
        <shadowMaterial
          color={shadowColor}
          opacity={1}
          blending={THREE.NormalBlending}
        />
      </mesh>
    </group>
  );
}
