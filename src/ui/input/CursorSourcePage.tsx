import { useEffect, useRef, useState } from 'react'
import { SETTINGS } from '@/settings/GameSettings'

type ConnectionState = 'connecting' | 'open' | 'closed'

type LatencyStats = {
  p50: number
  p95: number
  p99: number
}

type UiStats = {
  connectionState: ConnectionState
  sentCount: number
  sendFps: number
  frameAckFps: number
  frameAge: LatencyStats
  probeRtt: LatencyStats
  relayEchoRtt: LatencyStats
  probeJitterMs: number
  probeLossPercent: number
  url: string
}

type SampleWindow = {
  values: Float64Array
  writeIndex: number
  count: number
}

const DOT_SIZE_PX = 18
const HAND_POINTER_ID = 'hand_0'
const PROBE_INTERVAL_MS = 500
const PROBE_TIMEOUT_MS = 4000
const TELEMETRY_HEARTBEAT_MS = 1000
const SAMPLE_WINDOW_SIZE = 256

function clamp01(value: number): number {
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

function normalizeEventTime(timeStamp: number): number {
  if (!Number.isFinite(timeStamp) || timeStamp <= 0 || timeStamp > 1e9) {
    return performance.now()
  }
  return timeStamp
}

function makeWindow(): SampleWindow {
  return {
    values: new Float64Array(SAMPLE_WINDOW_SIZE),
    writeIndex: 0,
    count: 0,
  }
}

function pushSample(window: SampleWindow, value: number): void {
  if (!Number.isFinite(value)) return
  window.values[window.writeIndex] = value
  window.writeIndex = (window.writeIndex + 1) % window.values.length
  if (window.count < window.values.length) {
    window.count += 1
  }
}

function snapshotPercentiles(window: SampleWindow, scratch: Float64Array): LatencyStats {
  const count = window.count
  if (count <= 0) {
    return { p50: 0, p95: 0, p99: 0 }
  }

  const capacity = window.values.length
  const start = (window.writeIndex - count + capacity) % capacity
  for (let i = 0; i < count; i += 1) {
    scratch[i] = window.values[(start + i) % capacity]
  }
  const slice = scratch.subarray(0, count)
  slice.sort()

  const index50 = Math.min(count - 1, Math.floor((count - 1) * 0.5))
  const index95 = Math.min(count - 1, Math.floor((count - 1) * 0.95))
  const index99 = Math.min(count - 1, Math.floor((count - 1) * 0.99))

  return {
    p50: slice[index50] ?? 0,
    p95: slice[index95] ?? 0,
    p99: slice[index99] ?? 0,
  }
}

function computeJitter(window: SampleWindow): number {
  const count = window.count
  if (count < 2) return 0

  const capacity = window.values.length
  const start = (window.writeIndex - count + capacity) % capacity

  let totalDelta = 0
  let previous = window.values[start] ?? 0
  for (let i = 1; i < count; i += 1) {
    const current = window.values[(start + i) % capacity] ?? previous
    totalDelta += Math.abs(current - previous)
    previous = current
  }

  return totalDelta / Math.max(1, count - 1)
}

function formatStat(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '--'
  return `${value.toFixed(2)} ms`
}

function createSourceId(): string {
  return `cursor_source_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36)}`
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

export function CursorSourcePage() {
  const dotRef = useRef<HTMLDivElement | null>(null)

  const disposedRef = useRef(false)
  const websocketRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const probeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const telemetryHeartbeatTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const sourceIdRef = useRef(createSourceId())

  const connectionStateRef = useRef<ConnectionState>('connecting')
  const sentCountRef = useRef(0)
  const frameAckCountRef = useRef(0)
  const sendFpsRef = useRef(0)
  const frameAckFpsRef = useRef(0)
  const fpsSampleTimeRef = useRef(0)
  const fpsSampleSentRef = useRef(0)
  const fpsSampleAckRef = useRef(0)

  const frameSeqRef = useRef(0)
  const probeSeqRef = useRef(0)

  const probeSentCountRef = useRef(0)
  const probeLostCountRef = useRef(0)
  const pendingProbeMapRef = useRef(new Map<number, number>())

  const frameAgeWindowRef = useRef(makeWindow())
  const probeRttWindowRef = useRef(makeWindow())
  const relayEchoWindowRef = useRef(makeWindow())

  const frameAgeScratchRef = useRef(new Float64Array(SAMPLE_WINDOW_SIZE))
  const probeScratchRef = useRef(new Float64Array(SAMPLE_WINDOW_SIZE))
  const relayScratchRef = useRef(new Float64Array(SAMPLE_WINDOW_SIZE))

  const [uiStats, setUiStats] = useState<UiStats>(() => ({
    connectionState: 'connecting',
    sentCount: 0,
    sendFps: 0,
    frameAckFps: 0,
    frameAge: { p50: 0, p95: 0, p99: 0 },
    probeRtt: { p50: 0, p95: 0, p99: 0 },
    relayEchoRtt: { p50: 0, p95: 0, p99: 0 },
    probeJitterMs: 0,
    probeLossPercent: 0,
    url: SETTINGS.cursor.external.websocket.url,
  }))

  const uiStatsRef = useRef(uiStats)
  useEffect(() => {
    uiStatsRef.current = uiStats
  }, [uiStats])

  useEffect(() => {
    disposedRef.current = false
    sentCountRef.current = 0
    frameAckCountRef.current = 0
    sendFpsRef.current = 0
    frameAckFpsRef.current = 0
    fpsSampleTimeRef.current = performance.now()
    fpsSampleSentRef.current = 0
    fpsSampleAckRef.current = 0
    frameSeqRef.current = 0
    probeSeqRef.current = 0
    probeSentCountRef.current = 0
    probeLostCountRef.current = 0
    pendingProbeMapRef.current.clear()

    frameAgeWindowRef.current = makeWindow()
    probeRttWindowRef.current = makeWindow()
    relayEchoWindowRef.current = makeWindow()

    const sourceId = sourceIdRef.current
    const url = SETTINGS.cursor.external.websocket.url
    const reconnectMs = Math.max(100, SETTINGS.cursor.external.websocket.reconnectMs)

    const framePayload = {
      type: 'cursor_frame' as const,
      sourceId,
      seq: 0,
      sentEpochMs: 0,
      sourceTimeMs: 0,
      pointers: [
        {
          id: HAND_POINTER_ID,
          xNorm: 0,
          yNorm: 0,
        },
      ],
    }
    const payloadPointer = framePayload.pointers[0]

    const telemetrySubscribePayload = {
      type: 'latency_telemetry_subscribe' as const,
      sourceId,
      enable: true,
    }

    const telemetryUnsubscribePayload = {
      type: 'latency_telemetry_subscribe' as const,
      sourceId,
      enable: false,
    }

    const probePayload = {
      type: 'latency_probe' as const,
      sourceId,
      probeSeq: 0,
      sentEpochMs: 0,
    }

    const setConnectionState = (state: ConnectionState) => {
      connectionStateRef.current = state
      const current = uiStatsRef.current
      if (current.connectionState !== state) {
        setUiStats({
          connectionState: state,
          sentCount: current.sentCount,
          sendFps: current.sendFps,
          frameAckFps: current.frameAckFps,
          frameAge: current.frameAge,
          probeRtt: current.probeRtt,
          relayEchoRtt: current.relayEchoRtt,
          probeJitterMs: current.probeJitterMs,
          probeLossPercent: current.probeLossPercent,
          url: current.url,
        })
      }
    }

    const scheduleReconnect = () => {
      if (disposedRef.current || reconnectTimerRef.current) return
      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null
        connect()
      }, reconnectMs)
    }

    const sendTelemetrySubscribe = () => {
      const ws = websocketRef.current
      if (!ws || ws.readyState !== WebSocket.OPEN) return
      ws.send(JSON.stringify(telemetrySubscribePayload))
    }

    const scheduleTelemetryHeartbeat = () => {
      if (disposedRef.current) return
      if (telemetryHeartbeatTimerRef.current) return
      telemetryHeartbeatTimerRef.current = setTimeout(() => {
        telemetryHeartbeatTimerRef.current = null
        sendTelemetrySubscribe()
        scheduleTelemetryHeartbeat()
      }, TELEMETRY_HEARTBEAT_MS)
    }

    const sendProbe = () => {
      const ws = websocketRef.current
      if (!ws || ws.readyState !== WebSocket.OPEN) return

      probeSeqRef.current += 1
      const probeSeq = probeSeqRef.current
      probePayload.probeSeq = probeSeq
      probePayload.sentEpochMs = Date.now()
      ws.send(JSON.stringify(probePayload))
      probeSentCountRef.current += 1
      pendingProbeMapRef.current.set(probeSeq, performance.now())
    }

    const scheduleProbe = () => {
      if (disposedRef.current || probeTimerRef.current) return
      probeTimerRef.current = setTimeout(() => {
        probeTimerRef.current = null
        sendProbe()
        scheduleProbe()
      }, PROBE_INTERVAL_MS)
    }

    const connect = () => {
      if (disposedRef.current) return
      setConnectionState('connecting')

      try {
        websocketRef.current = new WebSocket(url)
      } catch {
        websocketRef.current = null
        setConnectionState('closed')
        scheduleReconnect()
        return
      }

      const ws = websocketRef.current
      if (!ws) return

      ws.onopen = () => {
        setConnectionState('open')
        sendTelemetrySubscribe()
        scheduleTelemetryHeartbeat()
        scheduleProbe()
      }

      ws.onmessage = (event) => {
        if (typeof event.data !== 'string') return

        let parsed: unknown
        try {
          parsed = JSON.parse(event.data)
        } catch {
          return
        }

        const packet = asRecord(parsed)
        if (!packet) return
        const packetType = packet.type
        if (typeof packetType !== 'string') return

        if (packetType === 'latency_probe') {
          const packetSourceId = packet.sourceId
          const packetProbeSeq = packet.probeSeq
          if (packetSourceId !== sourceId || typeof packetProbeSeq !== 'number') return
          const sentPerf = pendingProbeMapRef.current.get(packetProbeSeq)
          if (typeof sentPerf !== 'number') return
          const relayEchoRtt = performance.now() - sentPerf
          pushSample(relayEchoWindowRef.current, relayEchoRtt)
          return
        }

        if (packetType === 'latency_probe_ack') {
          const packetSourceId = packet.sourceId
          const packetProbeSeq = packet.probeSeq
          if (packetSourceId !== sourceId || typeof packetProbeSeq !== 'number') return
          const sentPerf = pendingProbeMapRef.current.get(packetProbeSeq)
          if (typeof sentPerf !== 'number') return
          pendingProbeMapRef.current.delete(packetProbeSeq)
          const probeRtt = performance.now() - sentPerf
          pushSample(probeRttWindowRef.current, probeRtt)
          return
        }

        if (packetType === 'cursor_frame_ack') {
          const packetSourceId = packet.sourceId
          const sentEpochMs = packet.sentEpochMs
          const receiverEpochMs = packet.receiverEpochMs
          if (packetSourceId !== sourceId) return
          if (typeof sentEpochMs !== 'number' || typeof receiverEpochMs !== 'number') return
          const frameAgeMs = receiverEpochMs - sentEpochMs
          pushSample(frameAgeWindowRef.current, frameAgeMs)
          frameAckCountRef.current += 1
        }
      }

      ws.onclose = () => {
        websocketRef.current = null
        if (disposedRef.current) return
        setConnectionState('closed')
        scheduleReconnect()
      }

      ws.onerror = () => {
        ws.close()
      }
    }

    const sendSample = (clientX: number, clientY: number, sourceTimeMs: number) => {
      const width = window.innerWidth
      const height = window.innerHeight
      if (!(width > 0) || !(height > 0)) return

      const xNorm = clamp01(clientX / width)
      const yNorm = clamp01(clientY / height)

      if (dotRef.current) {
        const dotX = xNorm * width - DOT_SIZE_PX * 0.5
        const dotY = yNorm * height - DOT_SIZE_PX * 0.5
        dotRef.current.style.transform = `translate3d(${dotX}px, ${dotY}px, 0)`
      }

      frameSeqRef.current += 1
      framePayload.seq = frameSeqRef.current
      framePayload.sentEpochMs = Date.now()
      framePayload.sourceTimeMs = sourceTimeMs
      if (payloadPointer) {
        payloadPointer.xNorm = xNorm
        payloadPointer.yNorm = yNorm
      }

      const ws = websocketRef.current
      if (!ws || ws.readyState !== WebSocket.OPEN) return

      ws.send(JSON.stringify(framePayload))
      sentCountRef.current += 1
    }

    const onPointerMove = (event: PointerEvent) => {
      if (!event.isPrimary) return

      const coalesced = typeof event.getCoalescedEvents === 'function'
        ? event.getCoalescedEvents()
        : []

      if (coalesced.length > 0) {
        for (let i = 0; i < coalesced.length; i += 1) {
          const sample = coalesced[i]
          const sampleTime = normalizeEventTime(sample.timeStamp)
          sendSample(sample.clientX, sample.clientY, sampleTime)
        }
        return
      }

      const eventTime = normalizeEventTime(event.timeStamp)
      sendSample(event.clientX, event.clientY, eventTime)
    }

    const onPointerDown = (event: PointerEvent) => {
      if (!event.isPrimary) return
      const eventTime = normalizeEventTime(event.timeStamp)
      sendSample(event.clientX, event.clientY, eventTime)
    }

    let rafId = 0
    const tickStats = () => {
      rafId = requestAnimationFrame(tickStats)
      const now = performance.now()

      const pending = pendingProbeMapRef.current
      pending.forEach((sentPerf, seq) => {
        if (now - sentPerf > PROBE_TIMEOUT_MS) {
          pending.delete(seq)
          probeLostCountRef.current += 1
        }
      })

      const elapsedMs = now - fpsSampleTimeRef.current
      if (elapsedMs >= 500) {
        const sentCount = sentCountRef.current
        const frameAckCount = frameAckCountRef.current
        const deltaSent = sentCount - fpsSampleSentRef.current
        const deltaAck = frameAckCount - fpsSampleAckRef.current

        sendFpsRef.current = deltaSent / (elapsedMs / 1000)
        frameAckFpsRef.current = deltaAck / (elapsedMs / 1000)

        fpsSampleTimeRef.current = now
        fpsSampleSentRef.current = sentCount
        fpsSampleAckRef.current = frameAckCount

        const frameAge = snapshotPercentiles(frameAgeWindowRef.current, frameAgeScratchRef.current)
        const probeRtt = snapshotPercentiles(probeRttWindowRef.current, probeScratchRef.current)
        const relayEchoRtt = snapshotPercentiles(relayEchoWindowRef.current, relayScratchRef.current)
        const probeJitterMs = computeJitter(probeRttWindowRef.current)

        const probeSent = probeSentCountRef.current
        const probeLossPercent = probeSent > 0
          ? (probeLostCountRef.current / probeSent) * 100
          : 0

        const current = uiStatsRef.current
        setUiStats({
          connectionState: connectionStateRef.current,
          sentCount,
          sendFps: sendFpsRef.current,
          frameAckFps: frameAckFpsRef.current,
          frameAge,
          probeRtt,
          relayEchoRtt,
          probeJitterMs,
          probeLossPercent,
          url: current.url,
        })
      }
    }

    connect()
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('pointerdown', onPointerDown, { passive: true })
    rafId = requestAnimationFrame(tickStats)

    return () => {
      disposedRef.current = true
      cancelAnimationFrame(rafId)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerdown', onPointerDown)

      const ws = websocketRef.current
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(telemetryUnsubscribePayload))
      }

      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
      if (probeTimerRef.current) {
        clearTimeout(probeTimerRef.current)
        probeTimerRef.current = null
      }
      if (telemetryHeartbeatTimerRef.current) {
        clearTimeout(telemetryHeartbeatTimerRef.current)
        telemetryHeartbeatTimerRef.current = null
      }

      websocketRef.current?.close()
      websocketRef.current = null
    }
  }, [])

  const statusColor = uiStats.connectionState === 'open'
    ? '#4ade80'
    : uiStats.connectionState === 'connecting'
      ? '#facc15'
      : '#f87171'

  return (
    <div
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        background: '#0b0b0d',
        color: '#fff',
        fontFamily: 'monospace',
        userSelect: 'none',
        cursor: 'crosshair',
      }}
    >
      <div
        ref={dotRef}
        style={{
          position: 'absolute',
          width: `${DOT_SIZE_PX}px`,
          height: `${DOT_SIZE_PX}px`,
          borderRadius: '999px',
          background: '#ffffff',
          boxShadow: '0 0 20px rgba(255,255,255,0.55)',
          pointerEvents: 'none',
          transform: `translate3d(${window.innerWidth * 0.5 - DOT_SIZE_PX * 0.5}px, ${window.innerHeight * 0.5 - DOT_SIZE_PX * 0.5}px, 0)`,
          willChange: 'transform',
        }}
      />

      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          padding: '10px 12px',
          background: 'rgba(0,0,0,0.45)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 8,
          pointerEvents: 'none',
          minWidth: 420,
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 700 }}>/cursor-source</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>Status:</span>
          <span style={{ color: statusColor, fontWeight: 700 }}>{uiStats.connectionState}</span>
        </div>
        <div>WS: {uiStats.url}</div>
        <div>Sent frames: {uiStats.sentCount}</div>
        <div>Send FPS: {uiStats.sendFps.toFixed(1)}</div>
        <div>Frame ACK FPS: {uiStats.frameAckFps.toFixed(1)}</div>

        <div style={{ marginTop: 4, opacity: 0.9 }}>Frame Age (source sentEpoch → game receiveEpoch)</div>
        <div>p50: {formatStat(uiStats.frameAge.p50)} | p95: {formatStat(uiStats.frameAge.p95)} | p99: {formatStat(uiStats.frameAge.p99)}</div>

        <div style={{ marginTop: 4, opacity: 0.9 }}>Probe RTT (source ↔ game ack)</div>
        <div>p50: {formatStat(uiStats.probeRtt.p50)} | p95: {formatStat(uiStats.probeRtt.p95)} | p99: {formatStat(uiStats.probeRtt.p99)}</div>
        <div>jitter: {formatStat(uiStats.probeJitterMs)} | loss: {uiStats.probeLossPercent.toFixed(1)}%</div>

        <div style={{ marginTop: 4, opacity: 0.9 }}>Relay Echo RTT (if relay echoes sender messages)</div>
        <div>p50: {formatStat(uiStats.relayEchoRtt.p50)} | p95: {formatStat(uiStats.relayEchoRtt.p95)} | p99: {formatStat(uiStats.relayEchoRtt.p99)}</div>

        <div style={{ opacity: 0.8 }}>Pointer: primary only (`hand_0`)</div>
      </div>
    </div>
  )
}
