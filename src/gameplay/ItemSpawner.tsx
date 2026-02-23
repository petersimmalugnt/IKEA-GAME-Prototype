import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { C4DMaterial } from '@/render/Materials'
import { SETTINGS } from '@/settings/GameSettings'
import { getActivePalette, resolveMaterialColorIndex } from '@/settings/GameSettings'
import { useSpawnerStore } from '@/gameplay/spawnerStore'
import {
  getFrustumCornersOnFloor,
  getMovementDirection,
  getRandomSpawnPointOnEdges,
  isPastLeftEdge,
  isPastBottomEdge,
  type FrustumCorners,
} from '@/gameplay/frustumBounds'

const _spawnPos = new THREE.Vector3()
const _moveDir = new THREE.Vector3()

export function ItemSpawner() {
  const { camera } = useThree()
  const spawnTimerRef = useRef(0)
  const spawnIdRef = useRef(0)

  const items = useSpawnerStore((state) => state.items)
  const addItem = useSpawnerStore((state) => state.addItem)
  const removeItem = useSpawnerStore((state) => state.removeItem)
  const updatePositions = useSpawnerStore((state) => state.updatePositions)

  useFrame((_state, delta) => {
    const cfg = SETTINGS.spawner
    if (!cfg.enabled) return

    const rawCorners = getFrustumCornersOnFloor(camera as THREE.OrthographicCamera)
    if (!rawCorners || rawCorners.length !== 4) return

    const corners: FrustumCorners = [rawCorners[0], rawCorners[1], rawCorners[2], rawCorners[3]]

    // Spawn timer
    spawnTimerRef.current += delta
    const intervalSec = cfg.spawnIntervalMs / 1000
    while (spawnTimerRef.current >= intervalSec && useSpawnerStore.getState().items.length < cfg.maxItems) {
      spawnTimerRef.current -= intervalSec
      getRandomSpawnPointOnEdges(
        corners,
        cfg.spawnEdgeInset,
        Math.random(),
        Math.random(),
        _spawnPos,
        cfg.spawnPadding
      )
      getMovementDirection(corners, _moveDir)
      const speed =
        cfg.speed + (Math.random() * 2 - 1) * cfg.speedVariance
      const vx = _moveDir.x * speed
      const vz = _moveDir.z * speed
      const palette = getActivePalette()
      const colorIndex = resolveMaterialColorIndex(
        Math.floor(Math.random() * palette.colors.length)
      )
      addItem({
        id: `spawn-${++spawnIdRef.current}`,
        position: [_spawnPos.x, cfg.radius, _spawnPos.z],
        velocity: [vx, 0, vz],
        colorIndex,
        radius: cfg.radius,
      })
    }

    updatePositions(delta)

    // Cull items past left or bottom edge (use fresh state after position update)
    const currentItems = useSpawnerStore.getState().items
    currentItems.forEach((item) => {
      const [x, , z] = item.position
      if (
        isPastLeftEdge(corners, x, z, cfg.cullPadding) ||
        isPastBottomEdge(corners, x, z, cfg.cullPadding)
      ) {
        removeItem(item.id)
      }
    })
  })

  return (
    <group>
      {items.map((item) => (
        <mesh
          key={item.id}
          position={item.position}
          castShadow
          receiveShadow
        >
          <sphereGeometry args={[item.radius, 32, 32]} />
          <C4DMaterial color={item.colorIndex} singleTone flatShading={false} />
        </mesh>
      ))}
    </group>
  )
}
