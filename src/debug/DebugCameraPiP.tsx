import { Hud, OrthographicCamera, useFBO } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";

const PIP_SIZE = 320;
const TOP_DOWN_HEIGHT = 40;
const TOP_DOWN_HALF = 7;

export function DebugCameraPiP() {
  const { gl, scene, size } = useThree();
  const fbo = useFBO(PIP_SIZE, PIP_SIZE, { depthBuffer: true });
  const topDownCam = useRef<THREE.OrthographicCamera | null>(null);

  useEffect(() => {
    topDownCam.current = new THREE.OrthographicCamera(
      -TOP_DOWN_HALF,
      TOP_DOWN_HALF,
      TOP_DOWN_HALF,
      -TOP_DOWN_HALF,
      0.1,
      100,
    );
    return () => {
      topDownCam.current = null;
    };
  }, []);

  useFrame(() => {
    const cam = topDownCam.current;
    if (!cam) return;

    cam.position.set(0, TOP_DOWN_HEIGHT, 0);
    cam.up.set(-1, -1, -1);
    cam.lookAt(0, 0, 0);
    cam.updateMatrixWorld();

    const oldTarget = gl.getRenderTarget();
    gl.setRenderTarget(fbo);
    gl.autoClear = true;
    gl.clear();
    gl.render(scene, cam);
    gl.setRenderTarget(oldTarget);
  }, 1);

  return (
    <Hud renderPriority={2}>
      <OrthographicCamera
        makeDefault
        position={[0, 0, 100]}
        left={0}
        right={size.width}
        top={size.height}
        bottom={0}
        near={0.1}
        far={200}
      />
      <mesh
        position={[PIP_SIZE / 2, PIP_SIZE / 2, 0]}
        scale={[PIP_SIZE, PIP_SIZE, 1]}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={fbo.texture} toneMapped={false} />
      </mesh>
    </Hud>
  );
}
