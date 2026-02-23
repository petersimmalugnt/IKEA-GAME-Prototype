import { useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Fragment } from 'react'
import { SETTINGS } from '@/settings/GameSettings'
import { useLevelTilingStore, getTileDepth, type LevelSegment } from '@/levels/levelTilingStore'
import { renderNode } from '@/LevelRenderer'

function SegmentGroup({ segment }: { segment: LevelSegment }) {
  return (
    <group position={[0, 0, segment.zOffset]}>
      {segment.data.nodes.map((node) => (
        <Fragment key={`${segment.id}-${node.id}`}>{renderNode(node)}</Fragment>
      ))}
    </group>
  )
}

export function LevelTileManager() {
  const { camera } = useThree()
  const segments = useLevelTilingStore((state) => state.segments)
  const initialized = useLevelTilingStore((state) => state.initialized)
  const initialize = useLevelTilingStore((state) => state.initialize)
  const spawnNextSegment = useLevelTilingStore((state) => state.spawnNextSegment)
  const cullSegment = useLevelTilingStore((state) => state.cullSegment)

  const tiling = SETTINGS.level.tiling

  useEffect(() => {
    if (!tiling.enabled || tiling.files.length === 0) return
    initialize(tiling.files)
  }, [tiling.enabled, tiling.files, initialize])

  useFrame(() => {
    if (!tiling.enabled || !initialized) return

    const followOffsetZ = SETTINGS.camera.mode === 'follow' ? SETTINGS.camera.follow.offset[2] : 0
    const viewCenterZ = camera.position.z - followOffsetZ
    const { lookAheadDistance, cullBehindDistance } = tiling

    let currentSegments = useLevelTilingStore.getState().segments
    let frontierZ =
      currentSegments.length > 0
        ? Math.min(
            ...currentSegments.map(
              (s) => s.zOffset - getTileDepth(s.data),
            ),
          )
        : 0

    let safety = 10
    while (frontierZ > viewCenterZ - lookAheadDistance && safety-- > 0) {
      useLevelTilingStore.getState().spawnNextSegment()
      currentSegments = useLevelTilingStore.getState().segments
      if (currentSegments.length === 0) break
      frontierZ = Math.min(
        ...currentSegments.map(
          (s) => s.zOffset - getTileDepth(s.data),
        ),
      )
    }

    currentSegments.forEach((segment) => {
      if (segment.zOffset > viewCenterZ + cullBehindDistance) {
        cullSegment(segment.id)
      }
    })
  })

  if (!tiling.enabled) return null
  if (!initialized || segments.length === 0) return null

  return (
    <>
      {segments.map((segment) => (
        <SegmentGroup key={segment.id} segment={segment} />
      ))}
    </>
  )
}
