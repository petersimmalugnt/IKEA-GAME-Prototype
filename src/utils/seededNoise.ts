export class SeededImprovedNoise {
  private readonly perm: number[]

  constructor(seed = 1337) {
    const source = Array.from({ length: 256 }, (_, index) => index)
    let state = ((Math.floor(seed) | 0) ^ 0x6D2B79F5) | 0

    const nextRandom = () => {
      state = (state + 0x6D2B79F5) | 0
      let t = Math.imul(state ^ (state >>> 15), 1 | state)
      t ^= t + Math.imul(t ^ (t >>> 7), 61 | t)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }

    for (let i = source.length - 1; i > 0; i -= 1) {
      const j = Math.floor(nextRandom() * (i + 1))
      const tmp = source[i]
      source[i] = source[j]
      source[j] = tmp
    }

    this.perm = new Array(512)
    for (let i = 0; i < 512; i += 1) {
      this.perm[i] = source[i & 255]
    }
  }

  noise(x: number, y: number, z: number): number {
    const floorX = Math.floor(x)
    const floorY = Math.floor(y)
    const floorZ = Math.floor(z)

    const X = floorX & 255
    const Y = floorY & 255
    const Z = floorZ & 255

    const localX = x - floorX
    const localY = y - floorY
    const localZ = z - floorZ

    const u = fade(localX)
    const v = fade(localY)
    const w = fade(localZ)

    const A = this.perm[X] + Y
    const AA = this.perm[A] + Z
    const AB = this.perm[A + 1] + Z
    const B = this.perm[X + 1] + Y
    const BA = this.perm[B] + Z
    const BB = this.perm[B + 1] + Z

    return lerp(
      w,
      lerp(
        v,
        lerp(
          u,
          grad(this.perm[AA], localX, localY, localZ),
          grad(this.perm[BA], localX - 1, localY, localZ),
        ),
        lerp(
          u,
          grad(this.perm[AB], localX, localY - 1, localZ),
          grad(this.perm[BB], localX - 1, localY - 1, localZ),
        ),
      ),
      lerp(
        v,
        lerp(
          u,
          grad(this.perm[AA + 1], localX, localY, localZ - 1),
          grad(this.perm[BA + 1], localX - 1, localY, localZ - 1),
        ),
        lerp(
          u,
          grad(this.perm[AB + 1], localX, localY - 1, localZ - 1),
          grad(this.perm[BB + 1], localX - 1, localY - 1, localZ - 1),
        ),
      ),
    )
  }
}

function fade(t: number): number {
  return t * t * t * (t * ((t * 6) - 15) + 10)
}

function lerp(t: number, a: number, b: number): number {
  return a + (t * (b - a))
}

function grad(hash: number, x: number, y: number, z: number): number {
  const h = hash & 15
  const u = h < 8 ? x : y
  const v = h < 4 ? y : (h === 12 || h === 14 ? x : z)
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v)
}
