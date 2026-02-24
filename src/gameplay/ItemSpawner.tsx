import { useRef, cloneElement, Children, useMemo, type ReactElement, type ReactNode } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { SETTINGS } from '@/settings/GameSettings'
import { getActivePalette, resolveMaterialColorIndex } from '@/settings/GameSettings'
import { useSpawnerStore, type SpawnedItem } from '@/gameplay/spawnerStore'
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

/** Renders a single spawned item — moves group via ref, no React re-renders. */
function SpawnedItemView({ item, templates }: { item: SpawnedItem; templates: ReactElement[] }) {
  const groupRef = useRef<THREE.Group>(null)
  const template = templates[item.templateIndex % templates.length]

  useFrame(() => {
    if (!groupRef.current) return
    // Since we mutate position arrays directly in the store, we just read them
    groupRef.current.position.set(item.position[0], item.position[1], item.position[2])
  })

  return (
    <group ref={groupRef} position={item.position}>
      {cloneElement(template as ReactElement<Record<string, unknown>>, {
        color: item.colorIndex,
        materialColor0: item.colorIndex,
        materialColor1: item.colorIndex,
      })}
    </group>
  )
}

export function ItemSpawner({ children }: { children: ReactNode }) {
  const { camera } = useThree()
  const spawnTimerRef = useRef(0)
  const spawnIdRef = useRef(0)

  const templates = useMemo(() => {
    return Children.toArray(children).filter(
      (child): child is ReactElement => typeof child === 'object' && child !== null && 'type' in child,
    )
  }, [children])

  const items = useSpawnerStore((state) => state.items)
  const addItem = useSpawnerStore((state) => state.addItem)
  const removeItem = useSpawnerStore((state) => state.removeItem)

  useFrame((_state, delta) => {
    const cfg = SETTINGS.spawner
    if (!cfg.enabled) return

    const corners = getFrustumCornersOnFloor(camera as THREE.OrthographicCamera)
    if (!corners || corners.length !== 4) return

    // Spawn timer
    spawnTimerRef.current += delta
    const intervalSec = cfg.spawnIntervalMs / 1000
    while (spawnTimerRef.current >= intervalSec && useSpawnerStore.getState().items.length < cfg.maxItems) {
      spawnTimerRef.current -= intervalSec
      getRandomSpawnPointOnEdges(
        corners as FrustumCorners,
        cfg.spawnEdgeInset,
        Math.random(),
        Math.random(),
        _spawnPos,
        cfg.spawnPadding
      )
      getMovementDirection(corners as FrustumCorners, _moveDir)
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
        templateIndex: Math.floor(Math.random() * templates.length),
      })
    }

    // Direct mutation of positions (no React/Zustand re-renders)
    const currentItems = useSpawnerStore.getState().items
    for (let i = currentItems.length - 1; i >= 0; i--) {
      const item = currentItems[i]
      item.position[0] += item.velocity[0] * delta
      item.position[1] += item.velocity[1] * delta
      item.position[2] += item.velocity[2] * delta

      // Cull items past left or bottom edge
      if (
        isPastLeftEdge(corners as FrustumCorners, item.position[0], item.position[2], cfg.cullPadding) ||
        isPastBottomEdge(corners as FrustumCorners, item.position[0], item.position[2], cfg.cullPadding)
      ) {
        removeItem(item.id)
      }
    }
  })

  return (
    <group>
      {items.map((item) => (
        <SpawnedItemView key={item.id} item={item} templates={templates} />
      ))}
    </group>
  )
}
