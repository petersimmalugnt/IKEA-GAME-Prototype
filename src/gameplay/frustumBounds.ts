import * as THREE from 'three'

/** NDC corners: [0]=bottom-left, [1]=bottom-right, [2]=top-right, [3]=top-left */
const NDC_CORNERS: [number, number, number][] = [
  [-1, -1, -1],
  [1, -1, -1],
  [1, 1, -1],
  [-1, 1, -1],
]

const _corner = new THREE.Vector3()
const _forward = new THREE.Vector3()
const _intersection = new THREE.Vector3()

/** Floor plane Y level used for intersection */
const FLOOR_Y = 0

/**
 * Projects the orthographic camera's frustum corners onto the floor plane (y=0).
 * Returns [bottomLeft, bottomRight, topRight, topLeft] in world space, or null if the camera doesn't intersect the floor.
 */
export function getFrustumCornersOnFloor(
  camera: THREE.OrthographicCamera
): THREE.Vector3[] | null {
  const cam = camera
  cam.updateMatrixWorld()
  cam.getWorldDirection(_forward)

  if (Math.abs(_forward.y) < 1e-6) return null

  const corners: THREE.Vector3[] = []

  for (let i = 0; i < 4; i++) {
    _corner.set(NDC_CORNERS[i][0], NDC_CORNERS[i][1], NDC_CORNERS[i][2])
    _corner.unproject(cam)

    const t = -_corner.y / _forward.y
    if (t < 0) return null

    _intersection.copy(_corner).addScaledVector(_forward, t)
    corners.push(new THREE.Vector3(_intersection.x, FLOOR_Y, _intersection.z))
  }

  return corners
}

/** Corner indices: 0=bottom-left, 1=bottom-right, 2=top-right, 3=top-left */
export type FrustumCorners = [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3]

function lerpCorner(a: THREE.Vector3, b: THREE.Vector3, t: number, out: THREE.Vector3): void {
  out.set(
    a.x + (b.x - a.x) * t,
    FLOOR_Y,
    a.z + (b.z - a.z) * t
  )
}

/** Random point between 0 and 1 along the segment from a to b (on floor plane). */
export function pointOnSegment(
  a: THREE.Vector3,
  b: THREE.Vector3,
  t: number,
  out: THREE.Vector3
): void {
  lerpCorner(a, b, t, out)
}

/** Midpoint of the top edge (corner 3 to 2). */
export function getTopEdgeMidpoint(corners: FrustumCorners, out: THREE.Vector3): void {
  pointOnSegment(corners[3], corners[2], 0.5, out)
}

/** Midpoint of the right edge (corner 2 to 1). */
export function getRightEdgeMidpoint(corners: FrustumCorners, out: THREE.Vector3): void {
  pointOnSegment(corners[2], corners[1], 0.5, out)
}

/** Midpoint of the bottom edge (corner 0 to 1). */
export function getBottomEdgeMidpoint(corners: FrustumCorners, out: THREE.Vector3): void {
  pointOnSegment(corners[0], corners[1], 0.5, out)
}

/** Midpoint of the left edge (corner 3 to 0). */
export function getLeftEdgeMidpoint(corners: FrustumCorners, out: THREE.Vector3): void {
  pointOnSegment(corners[3], corners[0], 0.5, out)
}

const _topMid = new THREE.Vector3()
const _rightMid = new THREE.Vector3()
const _bottomMid = new THREE.Vector3()
const _leftMid = new THREE.Vector3()

/**
 * Unit direction from the spawn region (top-right) toward the kill region (bottom-left).
 * Suitable for moving spawned items across the visible area.
 */
export function getMovementDirection(corners: FrustumCorners, out: THREE.Vector3): void {
  getTopEdgeMidpoint(corners, _topMid)
  getRightEdgeMidpoint(corners, _rightMid)
  getBottomEdgeMidpoint(corners, _bottomMid)
  getLeftEdgeMidpoint(corners, _leftMid)
  const spawnX = (_topMid.x + _rightMid.x) * 0.5
  const spawnZ = (_topMid.z + _rightMid.z) * 0.5
  const killX = (_bottomMid.x + _leftMid.x) * 0.5
  const killZ = (_bottomMid.z + _leftMid.z) * 0.5
  out.set(killX - spawnX, 0, killZ - spawnZ).normalize()
}

/**
 * Check if a point (x, z) is past the left edge (corner 3 to 0).
 * Left edge: from top-left to bottom-left. "Past" = in the negative screen-x direction.
 * Use a half-plane test: cross product from edge vector to point.
 */
export function isPastLeftEdge(corners: FrustumCorners, x: number, z: number): boolean {
  const ax = corners[3].x
  const az = corners[3].z
  const bx = corners[0].x
  const bz = corners[0].z
  const cross = (bx - ax) * (z - az) - (bz - az) * (x - ax)
  return cross > 0
}

/**
 * Check if a point (x, z) is past the bottom edge (corner 0 to 1).
 * Bottom edge: from bottom-left to bottom-right. "Past" = in the negative screen-y (down) direction.
 */
export function isPastBottomEdge(corners: FrustumCorners, x: number, z: number): boolean {
  const ax = corners[0].x
  const az = corners[0].z
  const bx = corners[1].x
  const bz = corners[1].z
  const cross = (bx - ax) * (z - az) - (bz - az) * (x - ax)
  return cross > 0
}

/**
 * Fill a Float32Array of 4 corners x 3 components for buffer geometry.
 * Order: [0], [1], [2], [3] with y = 0.003 for slight offset above floor.
 */
export function writeFrustumPositions(corners: FrustumCorners, y: number, positions: Float32Array): void {
  for (let i = 0; i < 4; i++) {
    positions[i * 3] = corners[i].x
    positions[i * 3 + 1] = y
    positions[i * 3 + 2] = corners[i].z
  }
}

/**
 * Random point on either the top edge (3→2) or right edge (2→1), with inset from corners.
 * @param inset 0..0.5; segment used is [inset, 1-inset] along the chosen edge
 * @param random uniform random in [0,1]; use two values: first picks edge, second picks t
 */
export function getRandomSpawnPointOnEdges(
  corners: FrustumCorners,
  inset: number,
  randomEdge: number,
  randomT: number,
  out: THREE.Vector3
): void {
  const lo = inset
  const hi = 1 - inset
  const t = lo + (hi - lo) * randomT
  if (randomEdge < 0.5) {
    pointOnSegment(corners[3], corners[2], t, out)
  } else {
    pointOnSegment(corners[2], corners[1], t, out)
  }
}
