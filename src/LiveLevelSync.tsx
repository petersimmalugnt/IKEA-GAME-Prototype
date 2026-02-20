import { useEffect } from 'react'
import { SETTINGS } from '@/settings/GameSettings'
import { useSettingsVersion } from '@/settings/settingsStore'
import { useLevelStore } from './levelStore'
import type { LevelData } from './levelStore'

function parseLevelMessage(data: string): LevelData | null {
  try {
    const parsed = JSON.parse(data) as unknown
    if (parsed === null || typeof parsed !== 'object') return null
    const obj = parsed as Record<string, unknown>

    if (typeof obj.version !== 'number') return null

    if (Array.isArray(obj.nodes)) {
      return { version: obj.version, nodes: obj.nodes }
    }

    if (Array.isArray(obj.objects)) {
      const nodes = (obj.objects as Record<string, unknown>[]).map((o) => ({
        id: (o.id as string) ?? crypto.randomUUID(),
        nodeType: 'object' as const,
        type: o.type as string,
        position: o.position as LevelData['nodes'][number]['position'],
        rotation: o.rotation as LevelData['nodes'][number]['rotation'],
        props: (o.props as Record<string, unknown>) ?? {},
      }))
      return { version: 2, nodes }
    }

    return null
  } catch {
    return null
  }
}

export function LiveLevelSync() {
  const settingsVersion = useSettingsVersion()
  const setLevelData = useLevelStore((state) => state.setLevelData)

  useEffect(() => {
    const { enabled, url, reconnectMs } = SETTINGS.level.liveSync
    if (!enabled || !url) return

    let ws: WebSocket | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let isDisposed = false

    const connect = () => {
      if (isDisposed) return
      ws = new WebSocket(url)

      ws.onmessage = (event) => {
        if (typeof event.data !== 'string') return
        const data = parseLevelMessage(event.data)
        if (data) setLevelData(data)
      }

      ws.onclose = () => {
        if (isDisposed) return
        reconnectTimer = setTimeout(connect, reconnectMs)
      }

      ws.onerror = () => {
        ws?.close()
      }
    }

    connect()

    return () => {
      isDisposed = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      ws?.close()
    }
  }, [settingsVersion, setLevelData])

  return null
}
