import { memo, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { SETTINGS } from '@/settings/GameSettings'
import { useLevelTilingStore, getTileDepth, type LevelSegment } from '@/levels/levelTilingStore'
import { renderNode } from '@/LevelRenderer'

const SegmentGroup = memo(function SegmentGroup({ segment }: { segment: LevelSegment }) {
  return (
    <group position={[0, 0, segment.zOffset]}>
      {segment.data.nodes.map((node) => renderNode(node))}
    </group>
  )
})

export function LevelTileManager() {
  const { camera } = useThree()
  const segments = useLevelTilingStore((state) => state.segments)
  const initialized = useLevelTilingStore((state) => state.initialized)
  const initialize = useLevelTilingStore((state) => state.initialize)
  const spawnNextSegment = useLevelTilingStore((state) => state.spawnNextSegment)
  const cullSegments = useLevelTilingStore((state) => state.cullSegments)

  const tiling = SETTINGS.level.tiling

  useEffect(() => {
    if (!tiling.enabled || tiling.files.length === 0) return
    initialize(tiling.files)
  }, [tiling.enabled, tiling.files, initialize])

  useFrame(() => {
    if (!tiling.enabled || !initialized) return

    // Tiling spawn/cull uses camera-derived center. If camera backtracking is allowed
    // (see SETTINGS.camera.follow.zClampMode), this center can move backwards and expose
    // already-culled segments. Keep this coupling explicit in camera settings.
    const followOffsetZ = SETTINGS.camera.mode === 'follow' ? SETTINGS.camera.follow.offset[2] : 0
    const viewCenterZ = camera.position.z - followOffsetZ
    const { lookAheadDistance, cullBehindDistance } = tiling

    const currentSegments = useLevelTilingStore.getState().segments
    const frontierZ =
      currentSegments.length > 0
        ? Math.min(
            ...currentSegments.map(
              (s) => s.zOffset - getTileDepth(s.data),
            ),
          )
        : 0

    if (frontierZ > viewCenterZ - lookAheadDistance) {
      spawnNextSegment()
    }

    const idsToCull: string[] = []
    currentSegments.forEach((segment) => {
      const segmentFarEdge = segment.zOffset - getTileDepth(segment.data)
      if (segmentFarEdge > viewCenterZ + cullBehindDistance) {
        idsToCull.push(segment.id)
      }
    })
    if (idsToCull.length > 0) {
      cullSegments(idsToCull)
    }
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
