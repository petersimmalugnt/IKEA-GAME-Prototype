import * as THREE from 'three'
import { useRef, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'

const NDC_CORNERS: [number, number, number][] = [
  [-1, -1, -1],
  [1, -1, -1],
  [1, 1, -1],
  [-1, 1, -1],
]

const _corner = new THREE.Vector3()
const _forward = new THREE.Vector3()
const _intersection = new THREE.Vector3()

export function CameraFrustumOverlay() {
  const { camera } = useThree()
  const meshRef = useRef<THREE.Mesh | null>(null)

  const { geometry, posAttr } = useMemo(() => {
    const positions = new Float32Array([
      -0.5, 0.003, -0.5,
       0.5, 0.003, -0.5,
       0.5, 0.003,  0.5,
      -0.5, 0.003,  0.5,
    ])
    const g = new THREE.BufferGeometry()
    const attr = new THREE.BufferAttribute(positions, 3)
    g.setAttribute('position', attr)
    g.setIndex([0, 1, 2, 0, 2, 3])
    g.computeBoundingSphere()
    return { geometry: g, posAttr: attr }
  }, [])

  useFrame(() => {
    const cam = camera as THREE.OrthographicCamera
    cam.updateMatrixWorld()
    cam.getWorldDirection(_forward)

    if (Math.abs(_forward.y) < 1e-6) return

    const positions = posAttr.array as Float32Array

    for (let i = 0; i < 4; i++) {
      _corner.set(NDC_CORNERS[i][0], NDC_CORNERS[i][1], NDC_CORNERS[i][2])
      _corner.unproject(cam)

      const t = -_corner.y / _forward.y
      if (t < 0) return

      _intersection.copy(_corner).addScaledVector(_forward, t)

      positions[i * 3] = _intersection.x
      positions[i * 3 + 1] = 0.003
      positions[i * 3 + 2] = _intersection.z
    }

    posAttr.needsUpdate = true
    geometry.computeBoundingSphere()
  })

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      frustumCulled={false}
      userData={{ excludeFromOutlines: true }}
    >
      <meshBasicMaterial
        color="#4dabf7"
        transparent
        opacity={0.18}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}
