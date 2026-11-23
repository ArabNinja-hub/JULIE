/**
 * Procedural lunar terrain engine.
 *
 * A single deterministic height function drives everything: the terrain
 * mesh, the player's ground height, rock placement and vertex colours.
 * Four regions are carved into one continuous world (400 × 400 units):
 *
 *   (-100,-100)  Sea of Tranquility  — flat dark mare
 *   ( 100,-100)  Copernicus Crater   — huge crater, terraced rim, central peak
 *   (-100, 100)  Tycho Crater        — bright crater with radiating rays
 *   ( 100, 100)  Lunar South Pole   — rugged, shadowed, water-ice country
 *
 * Everything is seeded and deterministic, so the world is identical on
 * every visit and every device.
 */

import * as THREE from 'three'

export const WORLD = { size: 400, bound: 185 }

/** The named craters, exported so landmarks can be placed on real features. */
export const CRATER_SITES = {
  copernicus: { x: 100, z: -100 },
  tycho: { x: -100, z: 100 },
  shackleton: { x: 100, z: 100 },
  tranquillity: { x: -100, z: -100 },
}

/* ---------- Deterministic value noise ---------- */

function hash2(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return n - Math.floor(n)
}

function smooth(t) {
  return t * t * (3 - 2 * t)
}

/** Seeded PRNG — deterministic geometry and textures. */
const mulberry = (seed) => {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function valueNoise(x, y) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const xf = x - xi
  const yf = y - yi
  const a = hash2(xi, yi)
  const b = hash2(xi + 1, yi)
  const c = hash2(xi, yi + 1)
  const d = hash2(xi + 1, yi + 1)
  const u = smooth(xf)
  const v = smooth(yf)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}

/**
 * Fractal noise, deliberately band-limited.
 *
 * Two details matter for a mesh that samples every 1.56 m:
 *   • lacunarity 2.0 exactly, so octave 2 fills the frequency the first
 *     octave leaves behind. A non-integer ratio (the old 2.1) left a
 *     visible spectral gap that aliased into diagonal moiré.
 *   • each octave is half the amplitude and twice the frequency, so the
 *     series is well behaved; combined with an explicit `maxFreq` guard
 *     below, no octave ever asks the mesh to represent something it
 *     cannot.
 */
function fbm(x, y, octaves = 4, maxFreq = Infinity) {
  let sum = 0
  let amp = 0.5
  let freq = 1
  let norm = 0
  for (let i = 0; i < octaves; i++) {
    if (freq > maxFreq) break
    sum += amp * (valueNoise(x * freq, y * freq) - 0.5)
    norm += amp
    amp *= 0.5
    freq *= 2
  }
  return norm > 0 ? sum / norm + 0.5 : 0.5
}

/** Anisotropic fbm: different frequencies along x and z. */
function fbm2(x, y, fx, fy, octaves, maxFreq = Infinity) {
  let sum = 0
  let amp = 0.5
  let norm = 0
  let sx = fx
  let sy = fy
  for (let i = 0; i < octaves; i++) {
    if (Math.max(sx, sy) > maxFreq) break
    sum += amp * (valueNoise(x * sx, y * sy) - 0.5)
    norm += amp
    amp *= 0.5
    sx *= 2
    sy *= 2
  }
  return norm > 0 ? sum / norm + 0.5 : 0.5
}

/* ---------- Craters ---------- *//* ---------- Craters ---------- */

const CRATERS = [
  { x: 100, z: -100, r: 45, depth: 11 }, // Copernicus
  { x: -100, z: 100, r: 38, depth: 9, rayed: true }, // Tycho
  { x: 100, z: 100, r: 26, depth: 10 }, // Shackleton (south pole)
  { x: -100, z: -100, r: 18, depth: 3.5 }, // mare crater
  { x: 40, z: 30, r: 14, depth: 3 },
  { x: -40, z: -30, r: 16, depth: 3.5 },
  { x: 0, z: -60, r: 12, depth: 2.5 },
  { x: -60, z: 40, r: 11, depth: 2.5 },
  { x: 60, z: 60, r: 13, depth: 3 },
  { x: 20, z: 120, r: 10, depth: 2.5 },
  { x: -120, z: 20, r: 12, depth: 3 },
  { x: 130, z: -20, r: 11, depth: 2.5 },
  { x: -20, z: -130, r: 13, depth: 3 },
  { x: 150, z: 40, r: 12, depth: 3 },
]

function craterHeight(x, z, c) {
  const d = Math.hypot(x - c.x, z - c.z)
  if (d > c.r * 1.7) return 0
  let h = 0
  if (d < c.r) {
    const t = d / c.r
    // Smoothstep bowl: zero slope at the lip, no crease with the rim
    const u = 1 - t
    h -= c.depth * u * u * u * (u * (u * 6 - 15) + 10)
    // Central peak on the big craters
    if (c.r >= 30) {
      // Central peak: a compact mountain rebounding from the crater floor
      const p = d / (c.r * 0.16)
      h += c.depth * 0.62 * Math.exp(-p * p)
    }
  }
  // Raised rim
  const rimT = (d - c.r) / (c.r * 0.16)
  h += c.depth * 0.4 * Math.exp(-rimT * rimT)
  return h
}

/* ---------- Region masks ---------- */

function regionWeight(x, z, cx, cz, inner, outer) {
  const d = Math.hypot(x - cx, z - cz)
  const t = Math.min(1, Math.max(0, (outer - d) / (outer - inner)))
  return smooth(t)
}

/* ---------- The height function ---------- */

/* ---------- Small craters everywhere ----------
 * A real lunar surface is saturated with small impacts. One hash grid
 * gives hundreds of them for almost no cost: each cell deterministically
 * owns one craterlet, and only the 3×3 cells around a sample are tested.
 *
 * Minimum radius is 3.2 units — two mesh vertex spacings (1.56 m each).
 * Anything smaller cannot be represented by the mesh and would alias.
 */
const CELL = 26

function hashCell(ix, iz, seed) {
  let h =
    Math.imul(ix, 374761393) ^
    Math.imul(iz, 668265263) ^
    Math.imul(seed, 1103515245)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

function craterletField(x, z) {
  const cx = Math.floor(x / CELL)
  const cz = Math.floor(z / CELL)
  let sum = 0

  for (let oz = -1; oz <= 1; oz++) {
    for (let ox = -1; ox <= 1; ox++) {
      const ix = cx + ox
      const iz = cz + oz

      if (hashCell(ix, iz, 11) > 0.94) continue

      const px = (ix + hashCell(ix, iz, 23)) * CELL
      const pz = (iz + hashCell(ix, iz, 37)) * CELL
      const jr = hashCell(ix, iz, 53)
      const jd = hashCell(ix, iz, 71)

      const r = 3.3 + jr * jr * 11
      const depth = (0.4 + jd * 0.85) * (r / 11)

      const d = Math.hypot(x - px, z - pz)
      if (d > r * 2.1) continue

      const t = d / r
      if (t < 1) {
        // Bowl: a smoothstep profile, which has zero derivative both at
        // the centre and at the lip. The previous 1-t² bowl arrived at
        // the lip with a steep slope and then stopped dead, leaving a
        // crease that read as a nick on every craterlet.
        const u = 1 - t
        sum -= depth * u * u * u * (u * (u * 6 - 15) + 10) * 1.75
      }
      // Rim swell. The width is a fraction of the crater radius rather
      // than a fixed distance: a narrow fixed-width rim (the previous
      // 0.46/0.96 = 0.48 units) was sharper than a single mesh quad and
      // aliased into a visible nick on every craterlet.
      const kw = 0.34 + 0.16 * (1 - jr)
      const k = (t - 0.94) / kw
      sum += depth * 0.55 * Math.exp(-k * k)
    }
  }
  return sum
}

/* ---------- Landforms ----------
 * The Moon's surface is not rolling hills. It is built from a handful of
 * recognisable structures, and including them is most of what makes a
 * lunar landscape read as lunar:
 *   • wrinkle ridges  — tectonic folds in the maria, low and long
 *   • rilles          — sinuous collapse channels, metres to tens of m wide
 *   • massifs         — sharp highland ranges around the world edge
 */

/**
 * Wrinkle ridges: broad, low, elongated ridges that cross the maria.
 * A sine along one axis, smoothed by noise, gives the soft fold shape.
 */
function wrinkleRidges(x, z) {
  // Two crossing ridge systems, each with its own orientation
  const systems = [
    { ang: 0.62, freq: 0.026, phase: 1.7, amp: 2.6 },
    { ang: -0.38, freq: 0.034, phase: 4.1, amp: 1.9 },
  ]

  let sum = 0
  for (const s of systems) {
    const ca = Math.cos(s.ang)
    const sa = Math.sin(s.ang)
    // Distance across the ridge direction
    const d = (x * sa - z * ca) * s.freq + s.phase

    // Wobble the ridge line so it meanders rather than running dead straight
    const wobble = (fbm2(x, z, 0.018, 0.021, 2) - 0.5) * 3.4

    // A raised, rounded ridge: cos gives a smooth crest, no cusp
    const ridge = Math.cos((d + wobble) * Math.PI * 2)
    // Only the crests, and tapered so they fade into the plain
    const crest = Math.max(0, ridge)
    sum += crest * crest * s.amp
  }
  return sum
}

/**
 * Rilles: narrow channels where lava tubes collapsed or the crust pulled
 * apart. A distance-to-a-winding-line field gives a clean trough.
 */
function rilles(x, z) {
  // Path of the rille: z as a function of x, gently meandering
  const pathZ = -95 + Math.sin(x * 0.028 + 0.6) * 16 + Math.sin(x * 0.071) * 5
  const dist = Math.abs(z - pathZ)

  // Trough profile: smooth in, flat bottom, smooth out. No creases.
  const width = 5.4
  const t = Math.min(1, dist / width)
  const u = 1 - t
  const trough = u * u * u * (u * (u * 6 - 15) + 10)

  // Only present in a limited band, fading smoothly at both ends
  const band = Math.max(0, 1 - Math.abs(x + 40) / 120)
  const fade = band * band * (3 - 2 * band)

  return -trough * 4.2 * fade
}

/**
 * Direction of the Sun, shared by the key light and the sky, so the disc
 * you can see always sits exactly where the shadows say it should.
 */
export const SUN_DIRECTION = (() => {
  const v = { x: 95, y: 52, z: 68 }
  const len = Math.hypot(v.x, v.y, v.z)
  return { x: v.x / len, y: v.y / len, z: v.z / len }
})()

/* ---------- The main height function ---------- */

/**
 * Everything here is band-limited to features of roughly 10 m or larger,
 * because the mesh resolves 1.56 m per vertex. `MX` is the frequency cap
 * passed to the noise: at 0.15 cycles per unit the shortest wavelength is
 * about 6.7 m, comfortably above the two-vertex limit. This is what keeps
 * the skyline clean instead of sawtoothed.
 */
const MX = 0.15

function terrainHeightCore(x, z) {
  /* --- Broad relief: continents and basins --- */
  let h = (fbm2(x, z, 0.009, 0.0082, 3) - 0.5) * 13

  /* --- Mid-scale swells (wavelength ~19m) --- */
  h += (fbm2(x, z, 0.034, 0.031, 3, MX) - 0.5) * 4.2

  /* --- Roughness (wavelength ~11m) --- */
  h += (fbm2(x, z, 0.052, 0.047, 3, MX) - 0.5) * 1.9

  /* --- Fine undulation (wavelength ~7.7m) — the last resolvable detail --- */
  h += (fbm2(x, z, 0.072, 0.066, 2, MX) - 0.5) * 0.95

  /* --- Sea of Tranquility: smooth, flat basalt --- */
  const mareW = regionWeight(x, z, -100, -100, 55, 95)
  if (mareW > 0) {
    const mareH = (fbm2(x, z, 0.016, 0.015, 2, MX) - 0.5) * 1.5
    h = h * (1 - mareW) + mareH * mareW

    // Tectonic structure: the maria are not featureless. Wrinkle ridges
    // and a sinuous rille give the plain its real character.
    h += mareW * wrinkleRidges(x, z)
    h += mareW * rilles(x, z)
  }

  /* --- South pole: rugged highlands --- */
  const poleW = regionWeight(x, z, 100, 100, 50, 95)
  if (poleW > 0) {
    h += (fbm2(x, z, 0.024, 0.022, 3, MX) - 0.5) * 15 * poleW
    h += (fbm2(x, z, 0.045, 0.041, 3, MX) - 0.5) * 6 * poleW
    h += (fbm2(x, z, 0.075, 0.069, 2, MX) - 0.5) * 2.2 * poleW
  }

  /* --- The named craters --- */
  for (const c of CRATERS) h += craterHeight(x, z, c)

  /* --- Small cratering, everywhere except the smoothest mare --- */
  h += craterletField(x, z) * (1 - mareW * 0.72)

  /* --- Horizon massifs ---
   * A ring of mountains encircling the world. Radial distance (hypot)
   * rather than max(|x|,|z|): the L-infinity version creased along the
   * diagonals. The ridge term is a smooth polynomial, and the detailed
   * peaks come from the band-limited noise above.
   */
  const radius = Math.hypot(x, z)
  const ringT = Math.min(1, Math.max(0, (radius - 128) / 55))
  if (ringT > 0) {
    const ramp = smooth(ringT)

    // 4n(1-n) peaks smoothly at n = 0.5 with zero derivative — no crease
    const n1 = fbm2(x, z, 0.0125, 0.0118, 3, MX)
    const ridge = 4 * n1 * (1 - n1)

    // Peaks and gaps around the ring, so it reads as a range not a wall
    const ang = Math.atan2(z, x)
    const angular =
      0.5 + 0.5 * fbm(Math.cos(ang) * 2.4 + 41, Math.sin(ang) * 2.4 + 9, 3)

    const massif = ridge * 44 * angular + ridge * ridge * 16 * angular
    h += ramp * massif
  }

  return h
}

export function terrainHeight(x, z) {
  return terrainRaw(x, z) - landingPad(x, z)
}

/* ---------- Landing pads ----------
 * Each destination is reached on foot, so the arrival point sits on a
 * slightly smoothed patch — a gentle shelf rather than a cliff face.
 * Only the immediate landing area is flattened; the surrounding terrain
 * keeps every crater, rim and slope.
 */
// Keep these in sync with the spawns in destinations.js
const PADS = [
  { x: -78, z: -128 }, // Sea of Tranquility
  { x: 84, z: -84 }, // Copernicus approach
  { x: -84, z: 58 }, // Tycho approach
  { x: 106, z: 164 }, // South pole highlands
]
const PAD_RADIUS = 13
let padHeights = null

function landingPad(x, z) {
  // Cache each pad's own (unsmoothed) height on first use
  if (!padHeights) padHeights = PADS.map((p) => terrainRaw(p.x, p.z))

  let total = 0
  for (let i = 0; i < PADS.length; i++) {
    const d = Math.hypot(x - PADS[i].x, z - PADS[i].z)
    if (d > PAD_RADIUS) continue
    // Smoothstep weight: full flattening at the centre, easing out to the
    // surrounding terrain so the shelf blends rather than steps.
    const t = 1 - d / PAD_RADIUS
    const w = t * t * (3 - 2 * t)
    total += (terrainRaw(x, z) - padHeights[i]) * w
  }
  return total
}

/** Height without landing-pad smoothing (used by the pads themselves). */
function terrainRaw(x, z) {
  return terrainHeightCore(x, z)
}

/* ---------- Vertex colours ---------- */

const clamp01 = (v) => Math.min(1, Math.max(0, v))
const lerp = (a, b, t) => a + (b - a) * t

/**
 * Albedo of the lunar surface at a point.
 *
 * Real regolith is much darker than it looks from Earth — the highlands
 * sit around 0.13–0.18 reflectance and the maria around 0.07–0.10. The
 * moon only looks bright because there is no atmosphere to scatter light
 * and the sun is brutal. Keeping the albedo genuinely dark is what makes
 * a lit surface read as the Moon rather than as snow.
 *
 * Returns [r, g, b] in approximately 0..1 linear albedo.
 */
export function terrainColor(x, z, slope) {
  // Base highland regolith — dark, very slightly cool
  let r = 0.135
  let g = 0.140
  let b = 0.152

  // Broad albedo provinces: real highlands are mottled with brighter
  // crater ejecta and darker patches over many kilometres.
  const province = (fbm(x * 0.0032 + 9, z * 0.0032 + 2, 4) - 0.5) * 0.075
  r += province
  g += province
  b += province * 0.95

  // Fresh material on steep slopes: slope failure exposes lighter rock
  const fresh = Math.min(1, Math.pow(slope, 1.4)) * 0.055
  r += fresh
  g += fresh
  b += fresh

  // Maria — dark basalt plains, clearly darker than the highlands
  const mareW = regionWeight(x, z, -100, -100, 55, 95)
  if (mareW > 0) {
    // Slight blue-grey cast, as the maria appear through a telescope
    r = lerp(r, 0.072, mareW * 0.9)
    g = lerp(g, 0.078, mareW * 0.9)
    b = lerp(b, 0.094, mareW * 0.9)
  }

  // Tycho rays — fresh, high-albedo ejecta streaming outward
  const dx = x + 100
  const dz = z - 100
  const d = Math.hypot(dx, dz)
  if (d > 34 && d < 190) {
    const ang = Math.atan2(dz, dx)
    const streak =
      fbm(Math.cos(ang) * 4.5 + 11, Math.sin(ang) * 4.5 + 7, 3) * 0.75 +
      fbm(Math.cos(ang) * 13 + 2, Math.sin(ang) * 13 + 5, 2) * 0.25
    const fall = Math.pow(Math.max(0, 1 - (d - 34) / 156), 1.5)
    const ray = Math.max(0, streak - 0.44) * 2.0 * fall
    if (ray > 0) {
      r += ray * 0.11
      g += ray * 0.112
      b += ray * 0.112
    }
  }

  // Copernicus ejecta blanket — bright rays radiating from the rim
  {
    const dc = Math.hypot(x - 100, z + 100)
    if (dc > 42 && dc < 135) {
      const halo = Math.pow(Math.max(0, 1 - (dc - 42) / 93), 2)
      const mottling = 0.45 + fbm(x * 0.085 + 4, z * 0.085 + 8, 3) * 1.0
      const ang = Math.atan2(z + 100, x - 100)
      const rays =
        0.45 +
        Math.max(
          0,
          fbm(Math.cos(ang) * 7 + 31, Math.sin(ang) * 7 + 17, 2) - 0.46
        ) *
          2.4
      const v2 = Math.min(1, halo * mottling * rays)
      r += v2 * 0.10
      g += v2 * 0.101
      b += v2 * 0.104
    }
  }

  // South pole — permanently shadowed, ice-bearing patches. These are
  // colder and darker; some crater floors never see the sun at all.
  const poleW = regionWeight(x, z, 100, 100, 50, 95)
  if (poleW > 0) {
    const sh = fbm(x * 0.045 + 77, z * 0.045 + 13, 3)
    const shadow = Math.max(0, sh - 0.5) * 1.9 * poleW
    r = lerp(r, 0.045, Math.min(0.85, shadow))
    g = lerp(g, 0.048, Math.min(0.85, shadow))
    b = lerp(b, 0.062, Math.min(0.85, shadow))
  }

  // Fine granular variation — the regolith is never a flat tone
  const grain = (fbm(x * 0.06, z * 0.06, 3) - 0.5) * 0.022
  r += grain
  g += grain
  b += grain

  return [clamp01(r), clamp01(g), clamp01(b)]
}

/**
 * Fine detail in the *shading* only.
 *
 * A vertex mesh at 200 segments cannot show centimetre texture underfoot,
 * so the near-surface detail is added as a tight normal-ish variation
 * here, varying faster than the vertex spacing. This is what stops the
 * ground from looking like smooth painted glass when she walks on it.
 */
export function terrainDetail(x, z) {
  // Four scales, each roughly half the previous wavelength. These run
  // far below the mesh resolution, so they live only in the shading —
  // exactly where the ground needs them close up.
  const g1 = fbm2(x, z, 0.35, 0.33, 3) - 0.5 // ~3m  — dunes and drifts
  const g2 = fbm2(x, z, 1.1, 1.05, 3) - 0.5 // ~0.9m — clods and clumps
  const g3 = fbm2(x, z, 3.4, 3.2, 2) - 0.5 // ~0.3m — gravel
  const g4 = (valueNoise(x * 9.5, z * 9.5) - 0.5) // ~0.1m — grain

  return g1 * 0.55 + g2 * 0.32 + g3 * 0.2 + g4 * 0.1
}

/**
 * A sparse field of small stones rendered *as geometry*, for the ground
 * immediately around the explorer. Instanced and camera-relative, so it
 * gives the near field real parallax without paying for a dense mesh.
 *
 * Positions are deterministic in world space (not camera space) so the
 * stones stay put as she walks past them.
 */
export function nearFieldStones(cx, cz, radius, count, seed = 4242) {
  const out = []
  const rand = mulberry(seed)
  for (let i = 0; i < count; i++) {
    const a = rand() * Math.PI * 2
    const d = 1.2 + Math.sqrt(rand()) * radius
    const x = Math.round(cx) + Math.cos(a) * d
    const z = Math.round(cz) + Math.sin(a) * d
    const size = 0.04 + Math.pow(rand(), 2.2) * 0.42
    out.push({
      x,
      y: terrainHeight(x, z),
      z,
      size,
      ry: rand() * Math.PI * 2,
      rx: rand() * 0.9,
      rz: rand() * 0.9,
    })
  }
  return out
}

/* ---------- Canvas textures (procedural, no downloads) ---------- */


/**
 * Fine regolith normal map.
 *
 * Built from overlapping grains and small impact pits, then converted to
 * tangent-space normals from a height field. Tiled many times across the
 * terrain, this is what gives the ground its powdery, pitted character
 * and makes the low sun define every ripple.
 */
export function makeRegolithNormalTexture(size = 256) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')

  // Height field
  const h = new Float32Array(size * size)
  const rand = mulberry(7717)
  const n = (x, y) => {
    const xi = Math.floor(x)
    const yi = Math.floor(y)
    const fx = x - xi
    const fy = y - yi
    const u = fx * fx * (3 - 2 * fx)
    const v = fy * fy * (3 - 2 * fy)
    const hash = (a, b) => {
      const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453
      return s - Math.floor(s)
    }
    const a = hash(xi, yi)
    const b = hash(xi + 1, yi)
    const d = hash(xi, yi + 1)
    const e = hash(xi + 1, yi + 1)
    return a + (b - a) * u + (d - a) * v + (a - b - d + e) * u * v
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Wrap coordinates so the tile is seamless
      const u = (x / size) * Math.PI * 2
      const v = (y / size) * Math.PI * 2
      const cx = Math.cos(u) * 3.1
      const cy = Math.sin(u) * 3.1
      const cz = Math.cos(v) * 3.1
      const cz2 = Math.sin(v) * 3.1

      let val =
        n(cx * 2.5 + cz * 0.7, cy * 2.5 + cz2 * 0.7) * 0.5 +
        n(cx * 7 + cz * 2.2, cy * 7 + cz2 * 2.2) * 0.3 +
        n(cx * 19 + cz * 6, cy * 19 + cz2 * 6) * 0.2
      h[y * size + x] = val
    }
  }

  // Sprinkle small impact pits — shallow, with a raised lip
  for (let i = 0; i < 260; i++) {
    const cx = rand() * size
    const cy = rand() * size
    const r = 1.2 + Math.pow(rand(), 2) * 7
    const depth = 0.1 + rand() * 0.25
    const R = Math.ceil(r * 1.7)
    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        const px = (Math.floor(cx) + dx + size) % size
        const py = (Math.floor(cy) + dy + size) % size
        const d = Math.hypot(dx, dy) / r
        if (d > 1.7) continue
        let add = 0
        if (d < 1) add = -depth * (1 - d * d)
        const lip = (d - 0.92) / 0.3
        add += depth * 0.55 * Math.exp(-lip * lip)
        h[py * size + px] += add
      }
    }
  }

  // Height → normal map
  const img = ctx.createImageData(size, size)
  const d = img.data
  const strength = 2.4
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const xl = (x - 1 + size) % size
      const xr = (x + 1) % size
      const yu = (y - 1 + size) % size
      const yd = (y + 1) % size
      const gx = h[y * size + xr] - h[y * size + xl]
      const gy = h[yd * size + x] - h[yu * size + x]

      let nx = -gx * strength
      let ny = -gy * strength
      const nz = 1
      const len = Math.hypot(nx, ny, nz)
      nx /= len
      ny /= len

      const o = (y * size + x) * 4
      d[o] = Math.round((nx * 0.5 + 0.5) * 255)
      d[o + 1] = Math.round((ny * 0.5 + 0.5) * 255)
      d[o + 2] = Math.round((nz / len * 0.5 + 0.5) * 255)
      d[o + 3] = 255
    }
  }

  ctx.putImageData(img, 0, 0)
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  // The terrain spans 400 units, so 240 repeats gives a 1.67-unit tile —
  // about the size of a single visible patch of ground underfoot. Mipmaps
  // handle the distance, where the detail fades into a smooth tone.
  tex.repeat.set(240, 240)
  tex.anisotropy = 8
  return tex
}

/**
 * Roughness map for the regolith: dusty patches are rough, exposed rock
 * and fresh ejecta are slightly smoother. Kept subtle — the Moon has no
 * gloss to speak of.
 */
export function makeRegolithRoughnessTexture(size = 256) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')
  const img = ctx.createImageData(size, size)
  const d = img.data
  const rand = mulberry(3311)

  // Low-frequency blotches of fine dust vs coarser granules
  const blotch = (x, y) => {
    const u = (x / size) * Math.PI * 2
    const v = (y / size) * Math.PI * 2
    return (
      Math.sin(u * 2.3 + Math.cos(v * 1.7)) * 0.5 +
      Math.sin(v * 3.1 + Math.cos(u * 2.2)) * 0.5
    )
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const b = blotch(x, y)
      const grain = rand()
      // 0.86 .. 0.99 — almost entirely rough
      const rough = 0.9 + b * 0.045 + grain * 0.03
      const o = (y * size + x) * 4
      const v = Math.round(Math.min(1, Math.max(0, rough)) * 255)
      d[o] = v
      d[o + 1] = v
      d[o + 2] = v
      d[o + 3] = 255
    }
  }

  ctx.putImageData(img, 0, 0)
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(120, 120)
  return tex
}

export function makeEarthTexture() {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 256
  const ctx = c.getContext('2d')
  const ocean = ctx.createLinearGradient(0, 0, 0, 256)
  ocean.addColorStop(0, '#1c4d8f')
  ocean.addColorStop(0.5, '#2a6cb8')
  ocean.addColorStop(1, '#1c4d8f')
  ctx.fillStyle = ocean
  ctx.fillRect(0, 0, 512, 256)
  // Continents — soft blobs
  const blobs = [
    [90, 80, 60, 34], [150, 120, 44, 26], [300, 70, 70, 40],
    [360, 130, 50, 30], [420, 90, 40, 24], [230, 170, 46, 26],
  ]
  for (const [x, y, rx, ry] of blobs) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, rx)
    g.addColorStop(0, 'rgba(90,140,90,0.9)')
    g.addColorStop(1, 'rgba(90,140,90,0)')
    ctx.fillStyle = g
    ctx.save()
    ctx.translate(x, y)
    ctx.scale(1, ry / rx)
    ctx.translate(-x, -y)
    ctx.beginPath()
    ctx.arc(x, y, rx, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
  // Clouds
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * 512
    const y = Math.random() * 256
    const r = 8 + Math.random() * 26
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, 'rgba(255,255,255,0.5)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  return c
}

export function makeGlowTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.35, 'rgba(196,181,253,0.55)')
  g.addColorStop(1, 'rgba(196,181,253,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  return c
}

/**
 * Marker glyph: a small diamond inside a broken ring, drawn once on a
 * canvas and used as a billboard sprite. Reads clearly at any distance.
 */
export function makeMarkerTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const ctx = c.getContext('2d')
  ctx.clearRect(0, 0, 128, 128)

  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 3
  ctx.lineCap = 'round'

  // Broken ring
  for (let i = 0; i < 4; i++) {
    const start = i * (Math.PI / 2) + 0.28
    ctx.beginPath()
    ctx.arc(64, 64, 40, start, start + 0.9)
    ctx.stroke()
  }

  // Diamond
  ctx.beginPath()
  ctx.moveTo(64, 40)
  ctx.lineTo(80, 64)
  ctx.lineTo(64, 88)
  ctx.lineTo(48, 64)
  ctx.closePath()
  ctx.fillStyle = '#ffffff'
  ctx.fill()

  // Soft outer bloom
  const g = ctx.createRadialGradient(64, 64, 20, 64, 64, 64)
  g.addColorStop(0, 'rgba(255,255,255,0.18)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.globalCompositeOperation = 'source-atop'
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)

  return c
}
