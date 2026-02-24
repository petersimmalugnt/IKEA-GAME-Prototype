import { useRef, cloneElement, Children, useMemo, type ReactElement, type ReactNode } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { SETTINGS } from '@/settings/GameSettings'
import { getActivePalette, resolveMaterialColorIndex } from '@/settings/GameSettings'
import { useSpawnerStore, getItemMotion, type SpawnedItemDescriptor } from '@/gameplay/spawnerStore'
import { useEntityStore } from '@/entities/entityStore'
import { isPlaying } from '@/game/gamePhaseStore'
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

function SpawnedItemView({ item, templates }: { item: SpawnedItemDescriptor; templates: ReactElement[] }) {
  const groupRef = useRef<THREE.Group>(null)
  const template = templates[item.templateIndex % templates.length]

  useFrame(() => {
    if (!groupRef.current) return
    const motion = getItemMotion(item.id)
    if (!motion) return
    groupRef.current.position.set(motion.position[0], motion.position[1], motion.position[2])
  })

  return (
    <group ref={groupRef}>
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
  const registerEntity = useEntityStore((state) => state.register)
  const unregisterEntity = useEntityStore((state) => state.unregister)

  useFrame((_state, delta) => {
    if (!isPlaying()) return
    const cfg = SETTINGS.spawner
    if (!cfg.enabled) return

    const corners = getFrustumCornersOnFloor(camera as THREE.OrthographicCamera)
    if (!corners || corners.length !== 4) return

    spawnTimerRef.current += delta
    const intervalSec = cfg.spawnIntervalMs / 1000
    while (spawnTimerRef.current >= intervalSec && useSpawnerStore.getState().activeCount < cfg.maxItems) {
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
      const itemId = `spawn-${++spawnIdRef.current}`
      addItem(
        { id: itemId, colorIndex, radius: cfg.radius, templateIndex: Math.floor(Math.random() * templates.length) },
        [_spawnPos.x, cfg.radius, _spawnPos.z],
        [vx, 0, vz],
      )
      registerEntity(itemId, 'spawned_item')
    }

    const currentItems = useSpawnerStore.getState().items
    for (let i = currentItems.length - 1; i >= 0; i--) {
      const item = currentItems[i]
      const motion = getItemMotion(item.id)
      if (!motion) continue

      motion.position[0] += motion.velocity[0] * delta
      motion.position[1] += motion.velocity[1] * delta
      motion.position[2] += motion.velocity[2] * delta

      if (
        isPastLeftEdge(corners as FrustumCorners, motion.position[0], motion.position[2], cfg.cullPadding) ||
        isPastBottomEdge(corners as FrustumCorners, motion.position[0], motion.position[2], cfg.cullPadding)
      ) {
        unregisterEntity(item.id)
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
