import * as THREE from 'three'
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { SETTINGS, getActiveBackground } from '@/settings/GameSettings'
import { updateCursorFromMouseEvent, getCursorScreenPos, decayCursorVelocity } from '@/input/cursorVelocity'

const MAX_TRAIL_POINTS = 96

type ScreenPoint = { sx: number; sy: number; time: number }

const _ndc = new THREE.Vector3()
const _trailColor = new THREE.Color()
const _bgColor = new THREE.Color()

export function CursorSystem() {
  const { gl } = useThree()
  const historyRef = useRef<ScreenPoint[]>([])

  const { line, positions, colors, posAttr, colorAttr } = useMemo(() => {
    const posBuf = new Float32Array(MAX_TRAIL_POINTS * 3)
    const colBuf = new Float32Array(MAX_TRAIL_POINTS * 3)
    const geometry = new THREE.BufferGeometry()
    const pAttr = new THREE.BufferAttribute(posBuf, 3)
    const cAttr = new THREE.BufferAttribute(colBuf, 3)
    pAttr.setUsage(THREE.DynamicDrawUsage)
    cAttr.setUsage(THREE.DynamicDrawUsage)
    geometry.setAttribute('position', pAttr)
    geometry.setAttribute('color', cAttr)
    geometry.setDrawRange(0, 0)

    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
      depthTest: false,
      transparent: true,
      opacity: 0.9,
    })
    const lineObj = new THREE.Line(geometry, material)
    lineObj.renderOrder = 999
    lineObj.frustumCulled = false
    return { line: lineObj, positions: posBuf, colors: colBuf, posAttr: pAttr, colorAttr: cAttr }
  }, [])

  useEffect(() => {
    const canvas = gl.domElement

    const onMouseMove = (e: MouseEvent) => {
      updateCursorFromMouseEvent(e.clientX, e.clientY)
    }

    canvas.style.cursor = 'none'
    window.addEventListener('mousemove', onMouseMove)

    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      canvas.style.cursor = ''
    }
  }, [gl])

  useFrame(({ camera }, delta) => {
    const canvas = gl.domElement
    const rect = canvas.getBoundingClientRect()
    const { width, height } = rect
    if (width === 0 || height === 0) return

    const now = performance.now()
    const { x: sx, y: sy } = getCursorScreenPos()
    const history = historyRef.current

    // Append current screen position
    history.push({ sx, sy, time: now })

    // Evict points older than maxAge
    const maxAgeMs = SETTINGS.cursor.trail.maxAge * 1000
    while (history.length > 1 && now - history[0].time > maxAgeMs) {
      history.shift()
    }

    // Hard cap
    if (history.length > MAX_TRAIL_POINTS) {
      history.splice(0, history.length - MAX_TRAIL_POINTS)
    }

    const count = history.length

    _trailColor.set(SETTINGS.cursor.trail.color)
    _bgColor.set(getActiveBackground())

    // Re-project all stored screen positions using the current camera.
    // This keeps the trace correctly anchored to screen space even as
    // the world scrolls beneath the cursor.
    for (let i = 0; i < count; i++) {
      const { sx: px, sy: py } = history[i]
      _ndc.set(
        (px / width) * 2 - 1,
        -(py / height) * 2 + 1,
        0,
      )
      _ndc.unproject(camera)
      positions[i * 3] = _ndc.x
      positions[i * 3 + 1] = _ndc.y
      positions[i * 3 + 2] = _ndc.z

      // Fade from background (tail) to trail color (head)
      const t = count > 1 ? i / (count - 1) : 1
      colors[i * 3] = _bgColor.r + (_trailColor.r - _bgColor.r) * t
      colors[i * 3 + 1] = _bgColor.g + (_trailColor.g - _bgColor.g) * t
      colors[i * 3 + 2] = _bgColor.b + (_trailColor.b - _bgColor.b) * t
    }

    line.geometry.setDrawRange(0, count)
    posAttr.needsUpdate = true
    colorAttr.needsUpdate = true

    decayCursorVelocity(delta)
  })

  return <primitive object={line} />
}
