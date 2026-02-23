import * as THREE from 'three'
import { useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  getFrustumCornersOnFloor,
  writeFrustumPositions,
  type FrustumCorners,
} from '@/gameplay/frustumBounds'

const FLOOR_OFFSET_Y = 0.003

export function CameraFrustumOverlay() {
  const { camera } = useThree()

  const { geometry, posAttr } = useMemo(() => {
    const positions = new Float32Array(4 * 3)
    const g = new THREE.BufferGeometry()
    const attr = new THREE.BufferAttribute(positions, 3)
    g.setAttribute('position', attr)
    g.setIndex([0, 1, 2, 0, 2, 3])
    g.computeBoundingSphere()
    return { geometry: g, posAttr: attr }
  }, [])

  useFrame(() => {
    const rawCorners = getFrustumCornersOnFloor(camera as THREE.OrthographicCamera)
    if (!rawCorners || rawCorners.length !== 4) return

    const corners: FrustumCorners = [rawCorners[0], rawCorners[1], rawCorners[2], rawCorners[3]]
    writeFrustumPositions(corners, FLOOR_OFFSET_Y, posAttr.array as Float32Array)
    posAttr.needsUpdate = true
    geometry.computeBoundingSphere()
  })

  return (
    <mesh
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
