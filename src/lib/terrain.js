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

function fbm(x, y, octaves = 4) {
  let amp = 0.5
  let freq = 1
  let sum = 0
  let norm = 0
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(x * freq, y * freq)
    norm += amp
    amp *= 0.5
    freq *= 2.1
  }
  return sum / norm // 0..1
}

/* ---------- Craters ---------- */

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
    h -= c.depth * (1 - t * t) // parabolic bowl
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

function terrainHeightCore(x, z) {
  // Base rolling plains
  let h = (fbm(x * 0.012 + 7, z * 0.012 + 3, 4) - 0.5) * 10

  // Sea of Tranquility — smooth, flat mare
  const mareW = regionWeight(x, z, -100, -100, 55, 95)
  const mareH = (fbm(x * 0.02 + 31, z * 0.02 + 17, 2) - 0.5) * 1.6
  h = h * (1 - mareW) + mareH * mareW

  // Lunar south pole — rugged highlands, but not impassable ones
  const poleW = regionWeight(x, z, 100, 100, 50, 95)
  h += (fbm(x * 0.028 + 53, z * 0.028 + 91, 4) - 0.5) * 11 * poleW

  // Craters
  for (const c of CRATERS) h += craterHeight(x, z, c)

  // Horizon massifs — a ridged ring of mountains at the world edge, so
  // the landscape always has something to climb toward on the skyline.
  const edge = Math.max(Math.abs(x), Math.abs(z))
  const et = Math.min(1, Math.max(0, (edge - 138) / 46))
  if (et > 0) {
    const ang = Math.atan2(z, x)
    // Ridged noise produces crests and valleys rather than rolling hills
    const ridged = 1 - Math.abs(fbm(x * 0.017 + 11, z * 0.017 + 5, 4) * 2 - 1)
    const massif =
      Math.pow(ridged, 1.7) * 44 +
      (fbm(Math.cos(ang) * 3.5 + 41, Math.sin(ang) * 3.5 + 9, 3) - 0.4) * 22
    h += smooth(et) * Math.max(0, massif)
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
  { x: -122, z: -128 }, // Sea of Tranquility
  { x: 92, z: -82 }, // Copernicus approach
  { x: -82, z: 44 }, // Tycho approach
  { x: 54, z: 126 }, // South pole highlands
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
 * Colour for a terrain vertex. `slope` is 0 (flat) .. 1 (cliff).
 * Blue-silver regolith, darker mare, bright Tycho rays, shadowed
 * south-pole patches — all procedural, no external imagery needed.
 */
export function terrainColor(x, z, slope) {
  // Base regolith: cool blue-silver, brightening on exposed slopes
  let r = 0.5 + slope * 0.24
  let g = 0.54 + slope * 0.24
  let b = 0.66 + slope * 0.22

  // Broad albedo provinces — large bright and dark regions of highland
  const province = (fbm(x * 0.0035 + 9, z * 0.0035 + 2, 3) - 0.5) * 0.3
  r += province
  g += province
  b += province * 0.85

  // Mare — darker, smoother basalt
  const mareW = regionWeight(x, z, -100, -100, 55, 95)
  r = lerp(r, 0.4, mareW * 0.7)
  g = lerp(g, 0.43, mareW * 0.7)
  b = lerp(b, 0.54, mareW * 0.7)

  // Tycho rays — bright ejecta streaks radiating outward
  const dx = x + 100
  const dz = z - 100
  const d = Math.hypot(dx, dz)
  if (d > 34 && d < 190) {
    const ang = Math.atan2(dz, dx)
    // Sample the angle as a ring so streaks run radially, then break
    // them up with noise so they read as ejecta rather than a starburst
    const streak =
      fbm(Math.cos(ang) * 4.5 + 11, Math.sin(ang) * 4.5 + 7, 3) * 0.75 +
      fbm(Math.cos(ang) * 13 + 2, Math.sin(ang) * 13 + 5, 2) * 0.25
    const fall = Math.pow(Math.max(0, 1 - (d - 34) / 156), 1.4)
    const ray = Math.max(0, streak - 0.42) * 2.2 * fall
    r += ray * 0.62
    g += ray * 0.62
    b += ray * 0.58
  }

  // Copernicus ejecta blanket — a bright halo around the rim
  {
    const dc = Math.hypot(x - 100, z + 100)
    if (dc > 40 && dc < 130) {
      const halo = Math.pow(Math.max(0, 1 - (dc - 40) / 90), 2) * 0.5
      const mottling = 0.55 + fbm(x * 0.09 + 4, z * 0.09 + 8, 3) * 0.9
      const v2 = halo * mottling
      r = lerp(r, 0.86, v2 * 0.7)
      g = lerp(g, 0.87, v2 * 0.7)
      b = lerp(b, 0.93, v2 * 0.7)
    }
  }

  // South pole — permanently shadowed patches
  const poleW = regionWeight(x, z, 100, 100, 50, 95)
  const sh = fbm(x * 0.05 + 77, z * 0.05 + 13, 3)
  const dark = Math.max(0, sh - 0.55) * 1.5 * poleW
  r -= dark * 0.3
  g -= dark * 0.3
  b -= dark * 0.28

  // Fine variation and a hint of mineral strata
  const v = (fbm(x * 0.08, z * 0.08, 2) - 0.5) * 0.1
  const strata = (fbm(x * 0.4 + 3, z * 0.4 + 7, 2) - 0.5) * 0.035

  return [
    clamp01(r + v + strata * 1.1),
    clamp01(g + v + strata),
    clamp01(b + v + strata * 0.8),
  ]
}

/* ---------- Canvas textures (procedural, no downloads) ---------- */

export function makeGroundTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#8a8f9e'
  ctx.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 9000; i++) {
    const v = 110 + Math.floor(Math.random() * 90)
    ctx.fillStyle = `rgba(${v},${v},${v + 8},${0.05 + Math.random() * 0.15})`
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 1.5, 1.5)
  }
  return c
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
