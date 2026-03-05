import * as THREE from 'three'
import { useCallback, useEffect, useMemo, useRef, type ReactNode, type RefObject } from 'react'
import { CameraFollow } from '@/camera/CameraFollow'
import type { PositionTargetHandle } from '@/scene/PositionTargetHandle'
import type { TargetPositionGetter, WorldPosition } from '@/scene/TargetAnchor'
import { CameraSystemContext, type CameraSystemContextValue } from '@/camera/CameraSystemContext'

type CameraSystemProviderProps = {
  playerRef: RefObject<PositionTargetHandle | null>
  directionalLightRef?: RefObject<THREE.DirectionalLight | null>
  children: ReactNode
}

export function CameraSystemProvider({ playerRef, directionalLightRef: externalLightRef, children }: CameraSystemProviderProps) {
  const cameraFocusRef = useRef<WorldPosition | null>(null)
  const targetGettersRef = useRef<Map<string, TargetPositionGetter>>(new Map())
  const internalLightRef = useRef<THREE.DirectionalLight | null>(null)
  const directionalLightRef = externalLightRef ?? internalLightRef

  const setTargetPositionGetter = useCallback((targetId: string, getter: TargetPositionGetter | null) => {
    if (getter) {
      targetGettersRef.current.set(targetId, getter)
      return
    }
    targetGettersRef.current.delete(targetId)
  }, [])

  useEffect(() => {
    setTargetPositionGetter('player', () => playerRef.current?.getPosition())
    return () => setTargetPositionGetter('player', null)
  }, [playerRef, setTargetPositionGetter])

  const getTargetPosition = useCallback((targetId: string): WorldPosition | undefined => {
    const getter = targetGettersRef.current.get(targetId)
    return getter ? getter() : undefined
  }, [])

  const getCameraFocus = useCallback((): WorldPosition | undefined => {
    return cameraFocusRef.current ?? undefined
  }, [])

  const contextValue = useMemo<CameraSystemContextValue>(() => ({
    setTargetPositionGetter,
    getTargetPosition,
    getCameraFocus,
    directionalLightRef,
  }), [setTargetPositionGetter, getTargetPosition, getCameraFocus, directionalLightRef])

  return (
    <CameraSystemContext.Provider value={contextValue}>
      <CameraFollow getTargetPosition={getTargetPosition} cameraFocusRef={cameraFocusRef} directionalLightRef={directionalLightRef} />
      {children}
    </CameraSystemContext.Provider>
  )
}
