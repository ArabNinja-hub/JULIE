/**
 * Procedural lunar surface.
 *
 * The moon's texture is built from a real heightfield rather than drawn
 * with rings: crater bowls, raised rims, ejecta blankets, highlands and
 * dark maria are all summed into a height grid, and the colour map is
 * lit from that grid (slope shading) so the surface has genuine relief
 * instead of outlined circles.
 *
 * Both the colour map and the bump map come from the same heightfield,
 * so the real-time lighting in Three.js reinforces the baked detail
 * rather than fighting it. JULIET is then engraved into the surface at
 * u = 0.25 — the point of a Three.js sphere that faces the camera — so
 * the name is part of the rock itself.
 *
 * Generation is deterministic (seeded) and runs once, in well under a
 * frame budget on a phone at 1024 × 512.
 */

/* ---------------- Deterministic noise ---------------- */

function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hash2(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return n - Math.floor(n)
}

function vnoise(x, y) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const fx = x - xi
  const fy = y - yi
  const u = fx * fx * (3 - 2 * fx)
  const v = fy * fy * (3 - 2 * fy)
  const a = hash2(xi, yi)
  const b = hash2(xi + 1, yi)
  const c = hash2(xi, yi + 1)
  const d = hash2(xi + 1, yi + 1)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}

function fbm(x, y, octaves = 4) {
  let sum = 0
  let amp = 0.5
  let norm = 0
  let fx = x
  let fy = y
  for (let i = 0; i < octaves; i++) {
    sum += amp * vnoise(fx, fy)
    norm += amp
    amp *= 0.5
    fx *= 2.03
    fy *= 2.03
  }
  return sum / norm
}

/**
 * Blend that returns to itself at u = 0, so anything defined with it is
 * exactly periodic in u (no seam) and has no line where it fades out.
 */
const cyclic = (u) => (1 - Math.cos(u * Math.PI * 2)) / 2

/**
 * Noise sampled around a circle, so the result is exactly periodic in u
 * and the texture has no seam where it wraps. Two harmonics of latitude
 * give vertical variation without breaking that periodicity.
 */
function periodicFbm(u, v, freq, octaves = 4) {
  const a = u * Math.PI * 2
  const cx = Math.cos(a) * freq
  const cy = Math.sin(a) * freq
  const lat = v * freq * 0.55
  return fbm(cx + lat * 0.7 + 3.1, cy + lat * 0.4 + 7.7, octaves)
}

/* ---------------- Crater catalogue ---------------- */

/**
 * Craters are placed in spherical-ish space: we sample the texture plane
 * with a slight horizontal bias so density stays even away from poles.
 * Radius is in texture pixels (texture height = H).
 */
function buildCraters(rand, W, H) {
  const craters = []
  const push = (x, y, r, opts = {}) => {
    craters.push({
      x,
      y,
      r,
      depth: opts.depth ?? Math.min(0.55, 0.16 + r / H) * (0.7 + rand() * 0.6),
      rim: opts.rim ?? 0.16 + rand() * 0.14,
      // Ejecta blankets on the larger impacts
      ejecta: r > H * 0.035 ? 1.1 + rand() * 0.9 : 0,
      peak: r > H * 0.05 ? 0.1 + rand() * 0.12 : 0,
      rayed: Boolean(opts.rayed),
      // Every real crater is slightly out of round. Two seeds drive an
      // angular wobble of the rim, so no two craters look stamped.
      wobA: rand() * Math.PI * 2,
      wobB: rand() * Math.PI * 2,
      wobAmt: 0.05 + rand() * 0.09,
    })
  }

  // Big ancient basins
  push(W * 0.62, H * 0.34, H * 0.19, { depth: 0.34, rim: 0.1 })
  push(W * 0.16, H * 0.6, H * 0.15, { depth: 0.3, rim: 0.09 })

  // Mid-size craters — a wide spread of ages, so rims vary in sharpness
  for (let i = 0; i < 24; i++) {
    const age = rand()
    push(rand() * W, rand() * H, H * (0.028 + Math.pow(rand(), 0.7) * 0.075), {
      depth: (0.14 + rand() * 0.26) * (0.55 + age * 0.75),
      rim: (0.08 + rand() * 0.16) * (0.5 + age * 0.9),
    })
  }

  // The showpiece: a bright rayed crater, like Tycho
  const tychoX = W * 0.25
  const tychoY = H * 0.72
  push(tychoX, tychoY, H * 0.075, { depth: 0.4, rim: 0.2, rayed: true })

  // Small cratering — unevenly scattered, with clusters where a swarm fell.
  // Older, shallower craters are softened so the surface reads as
  // accumulated history rather than fresh bubble wrap.
  for (let i = 0; i < 620; i++) {
    const t = rand()
    const r = H * (0.005 + Math.pow(t, 2.4) * 0.022)
    const weathered = rand()
    push(rand() * W, rand() * H, r, {
      depth: (0.1 + rand() * 0.14) * (0.4 + weathered * 0.8),
      rim: (0.06 + rand() * 0.1) * (0.35 + weathered * 0.8),
    })
  }

  // A handful of clusters — secondary cratering thrown out by big impacts
  for (let c = 0; c < 7; c++) {
    const ox = rand() * W
    const oy = rand() * H
    const count = 8 + Math.floor(rand() * 18)
    const spread = H * (0.02 + rand() * 0.05)
    for (let i = 0; i < count; i++) {
      const a = rand() * Math.PI * 2
      const d = Math.pow(rand(), 0.6) * spread
      push(
        ox + Math.cos(a) * d,
        oy + Math.sin(a) * d,
        H * (0.004 + rand() * 0.012),
        { depth: 0.09 + rand() * 0.1, rim: 0.07 + rand() * 0.08 }
      )
    }
  }

  return { craters, tycho: { x: tychoX, y: tychoY, r: H * 0.075 } }
}

/** Bucket craters into a coarse grid so each pixel checks only a few. */
function bucketise(craters, W, H) {
  const cell = Math.max(16, Math.round(H * 0.06))
  const cols = Math.ceil(W / cell)
  const rows = Math.ceil(H / cell)
  const grid = Array.from({ length: cols * rows }, () => [])

  craters.forEach((c, idx) => {
    const reach = c.r * (1 + c.ejecta) * 1.25
    const y0 = Math.max(0, Math.floor((c.y - reach) / cell))
    const y1 = Math.min(rows - 1, Math.floor((c.y + reach) / cell))

    // Register the crater three times — at x, x - W and x + W — so an
    // impact sitting on the seam is drawn correctly on both edges. The
    // wrap offset is stored with the entry.
    for (const shift of [0, -W, W]) {
      const cx = c.x + shift
      const x0 = Math.max(0, Math.floor((cx - reach) / cell))
      const x1 = Math.min(cols - 1, Math.floor((cx + reach) / cell))
      for (let gy = y0; gy <= y1; gy++) {
        for (let gx = x0; gx <= x1; gx++) {
          grid[gy * cols + gx].push(idx, shift)
        }
      }
    }
  })

  return { grid, cell, cols, rows }
}

/* ---------------- Height contribution of one crater ---------------- */

function craterProfile(c, dx, dy) {
  const d = Math.sqrt(dx * dx + dy * dy)
  const reach = c.r * (1 + c.ejecta) * (1 + c.wobAmt)
  if (d > reach) return 0

  // Angular warp: the rim wanders in and out, never a perfect circle.
  // Two harmonics of different frequency keep the shape organic.
  const ang = Math.atan2(dy, dx)
  const wob =
    1 +
    c.wobAmt *
      (Math.sin(ang * 2 + c.wobA) * 0.6 + Math.sin(ang * 3 + c.wobB) * 0.4)

  const r = c.r * wob
  const t = d / r
  let h = 0

  if (t < 1) {
    // Bowl: gently concave floor rising into steepening walls
    h -= c.depth * Math.pow(1 - t * t, 0.72)
    // Central peak in the big ones
    if (c.peak > 0) {
      const p = t / 0.24
      h += c.depth * c.peak * Math.exp(-p * p)
    }
  }

  // Rim: a broad soft swell that blends into the surroundings.
  // A sharp Gaussian here produces the "drawn circle" look to avoid.
  if (t > 0.6) {
    const k = (t - 0.94) / 0.34
    h += c.depth * c.rim * Math.exp(-k * k)
  }

  // Ejecta blanket fading out beyond the rim
  if (c.ejecta > 0 && t > 1) {
    h += Math.exp(-(t - 1) * 3.2) * 0.2 * c.depth
  }

  return h
}

/* ---------------- Main generator ---------------- */

export function createMoonTextures({ width = 1024, seed = 20241123 } = {}) {
  const W = width
  const H = Math.round(width / 2)
  const rand = mulberry32(seed)

  const colorCanvas = document.createElement('canvas')
  colorCanvas.width = W
  colorCanvas.height = H
  const ctx = colorCanvas.getContext('2d')

  const bumpCanvas = document.createElement('canvas')
  bumpCanvas.width = W
  bumpCanvas.height = H
  const bctx = bumpCanvas.getContext('2d')

  /* ---------- 1. Maria masks (dark, smooth basalt seas) ---------- */

  // Kept well clear of u = 0/1 (the seam) so no sea is ever cut in half
  const MARIA = [
    { x: 0.44, y: 0.34, rx: 0.17, ry: 0.14, rot: 0.4 },
    { x: 0.66, y: 0.46, rx: 0.13, ry: 0.1, rot: -0.3 },
    { x: 0.2, y: 0.6, rx: 0.12, ry: 0.1, rot: 0.8 },
    { x: 0.34, y: 0.2, rx: 0.1, ry: 0.08, rot: 0.1 },
    { x: 0.6, y: 0.68, rx: 0.09, ry: 0.07, rot: 0 },
    { x: 0.78, y: 0.24, rx: 0.08, ry: 0.07, rot: 0.5 },
  ]

  const mariaAt = (u, v) => {
    let m = 0
    for (const s of MARIA) {
      const dx = (u - s.x) / s.rx
      const dy = (v - s.y) / s.ry
      const cs = Math.cos(s.rot)
      const sn = Math.sin(s.rot)
      const rx = dx * cs - dy * sn
      const ry = dx * sn + dy * cs
      const d = Math.sqrt(rx * rx + ry * ry)
      // Soft, irregular edge (periodic so it never seams at the wrap)
      const ragged = 0.82 + periodicFbm(u, v, 9 + s.x * 10, 3) * 0.36
      const t = Math.max(0, 1 - d / ragged)
      m = Math.max(m, t * t * (3 - 2 * t))
    }
    return m
  }

  /* ---------- 2. Build the heightfield ---------- */

  const { craters, tycho } = buildCraters(rand, W, H)
  const { grid, cell, cols } = bucketise(craters, W, H)

  const height = new Float32Array(W * H)
  const mareMask = new Float32Array(W * H)
  const rayMask = new Float32Array(W * H)

  const rho = Math.sqrt(W * W + H * H) * 0.0022

  for (let y = 0; y < H; y++) {

    for (let x = 0; x < W; x++) {
      const i = y * W + x
      const u = x / W
      const v = y / H

      // Rolling highland relief. Each octave is multiplied by `cyclic`,
      // which vanishes smoothly at the seam and is perfectly flat there —
      // the wrapping edge of the texture is therefore identical on both
      // sides, and no line is visible as the moon turns.
      const cyc = cyclic(u)
      let h = (periodicFbm(u, v, 5.4, 5) - 0.5) * 0.09 * (0.25 + 0.75 * cyc)
      h += (periodicFbm(u, v, 17, 3) - 0.5) * 0.03 * (0.15 + 0.85 * cyc)
      h += (periodicFbm(u, v, 96, 2) - 0.5) * 0.009 * cyc
      h += (periodicFbm(u, v, 210, 2) - 0.5) * 0.0035 * cyc

      // Maria: smooth, low, basalt plains
      const m = mariaAt(u, v)
      mareMask[i] = m
      if (m > 0) {
        const plain = (periodicFbm(u, v, 4.2, 2) - 0.5) * 0.012
        h = h * (1 - m * 0.85) + plain * m
      }

      // Craters from the spatial grid, thinned near the wrapping edge
      const edgeFade = cyclic(u) > 0.06 ? 1 : 0
      const gx = Math.floor(x / cell)
      const gy = Math.floor(y / cell)
      const bucket = grid[gy * cols + gx]
      for (let k = 0; k < bucket.length && edgeFade; k += 2) {
        const c = craters[bucket[k]]
        const shift = bucket[k + 1]
        h += craterProfile(c, x - c.x - shift, y - c.y)
      }

      height[i] = h
    }
  }

  /* ---------- 3. Tycho's bright rays ---------- */

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x
      const dx = x - tycho.x
      const dy = y - tycho.y
      const dist = Math.sqrt(dx * dx + dy * dy) / tycho.r
      if (dist < 1.2 || dist > 9) continue

      const ang = Math.atan2(dy, dx)
      // Streaks as a function of angle only, broken up by noise
      const streak =
        fbm(Math.cos(ang) * 9 + 17, Math.sin(ang) * 9 + 4, 3) * 0.62 +
        fbm(Math.cos(ang) * 24 + 2, Math.sin(ang) * 24 + 11, 2) * 0.38
      const fall = Math.pow(Math.max(0, 1 - (dist - 1.2) / 7.8), 2.1)
      // Dense, thin filaments rather than a few hard spikes
      const amount = Math.max(0, streak - 0.5) * 1.5 * fall
      rayMask[i] = Math.min(1, amount) * cyclic(x / W)
    }
  }

  /* ---------- 4. Shade the heightfield into colour + bump ---------- */

  // Baked light comes from the upper right, matching the scene's key light
  const LX = 0.62
  const LY = -0.72
  const LZ = 0.55
  const strength = 3.4

  const colorData = ctx.createImageData(W, H)
  const bumpData = bctx.createImageData(W, H)
  const cd = colorData.data
  const bd = bumpData.data

  // Height range for bump normalisation
  let hMin = Infinity
  let hMax = -Infinity
  for (let i = 0; i < height.length; i++) {
    if (height[i] < hMin) hMin = height[i]
    if (height[i] > hMax) hMax = height[i]
  }
  const hSpan = Math.max(1e-5, hMax - hMin)

  for (let y = 0; y < H; y++) {
    const yUp = y > 0 ? y - 1 : y
    const yDn = y < H - 1 ? y + 1 : y

    for (let x = 0; x < W; x++) {
      const i = y * W + x
      const xL = x > 0 ? x - 1 : x
      const xR = x < W - 1 ? x + 1 : x

      const h = height[i]
      const gx = height[y * W + xR] - height[y * W + xL]
      const gy = height[yDn * W + x] - height[yUp * W + x]

      // Surface normal from the gradient (bump-map style)
      let nx = -gx * strength
      let ny = -gy * strength
      let nz = 1
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz)
      nx /= len
      ny /= len
      nz /= len

      let lambert = nx * LX + ny * LY + nz * LZ
      lambert = Math.max(0, lambert)

      const m = mareMask[i]
      const ray = rayMask[i]

      // Albedo: blue-silver highlands, darker basalt seas, bright ejecta
      let base = 0.58 + (fbm(x * 0.03, y * 0.03, 2) - 0.5) * 0.16
      // Broad albedo provinces, so the surface is not one flat grey
      base += (fbm(x * 0.0045 + 5, y * 0.0045 + 2, 3) - 0.5) * 0.22
      base *= 1 - m * 0.6
      base += ray * 0.32
      // Fresh crater floors are slightly brighter
      base += Math.max(0, -h) * 0.35

      // Light baked in *lightly*: enough to read the relief in the map
      // itself, but mostly albedo, so the real-time lights stay in charge
      // and the surface is never double-shaded into a flat white disc.
      let lum = base * (0.7 + lambert * 0.38)

      // A touch of ambient occlusion in the deep bowls
      lum *= 0.94 + Math.min(0.06, h * 0.4)

      lum = Math.max(0.02, Math.min(1, lum))

      const o = i * 4
      // Cool blue-silver cast
      cd[o] = Math.round(lum * 231 + 7)
      cd[o + 1] = Math.round(lum * 238 + 9)
      cd[o + 2] = Math.round(lum * 250 + 12)
      cd[o + 3] = 255

      // Bump: raw height, normalised
      const bh = Math.round(((h - hMin) / hSpan) * 255)
      bd[o] = bh
      bd[o + 1] = bh
      bd[o + 2] = bh
      bd[o + 3] = 255
    }
  }

  ctx.putImageData(colorData, 0, 0)
  bctx.putImageData(bumpData, 0, 0)

  /* ---------- 5. JULIET, engraved into the rock ---------- */

  const cx = W * 0.25 // front-facing point of the sphere
  const cy = H * 0.5 // equator
  const fontSize = Math.round(H * 0.088)
  const text = 'JULIET'

  const layout = (c, spacing) => {
    const widths = [...text].map((ch) => c.measureText(ch).width)
    const total = widths.reduce((a, b) => a + b, 0) + spacing * (text.length - 1)
    return { widths, total }
  }

  const setFont = (c, size) => {
    c.font = `600 ${size}px "Cormorant Garamond", Georgia, "Times New Roman", serif`
    c.textBaseline = 'middle'
    c.textAlign = 'left'
  }

  /* Colour map: carved letters — dark recess with a lit lower lip */
  setFont(ctx, fontSize)
  const spacing = fontSize * 0.26
  const { widths, total } = layout(ctx, spacing)
  let px = cx - total / 2

  ctx.save()
  // A soft shadow under the letters seats them into the rock
  ctx.shadowColor = 'rgba(8,10,18,0.6)'
  ctx.shadowBlur = fontSize * 0.16
  ctx.shadowOffsetY = fontSize * 0.05

  for (let i = 0; i < text.length; i++) {
    // Silver inlay — the name catching the light
    ctx.fillStyle = 'rgba(242,243,255,0.94)'
    ctx.fillText(text[i], px, cy)
    px += widths[i] + spacing
  }
  ctx.restore()

  // Dark bevel along the top edge, as if the letters were cut in
  px = cx - total / 2
  for (let i = 0; i < text.length; i++) {
    ctx.fillStyle = 'rgba(30,33,48,0.35)'
    ctx.fillText(text[i], px, cy - fontSize * 0.022)
    px += widths[i] + spacing
  }
  // Restore the lit face on top of the bevel
  px = cx - total / 2
  for (let i = 0; i < text.length; i++) {
    ctx.fillStyle = 'rgba(242,243,255,0.9)'
    ctx.fillText(text[i], px, cy + fontSize * 0.012)
    px += widths[i] + spacing
  }

  /* Bump map: the same letters, cut as a shallow groove.
     Re-using the measured widths keeps the two maps in exact register. */
  setFont(bctx, fontSize)
  px = cx - total / 2
  for (let i = 0; i < text.length; i++) {
    bctx.fillStyle = 'rgba(0,0,0,0.3)'
    bctx.fillText(text[i], px, cy)
    px += widths[i] + spacing
  }

  /* Flourish: a hairline with a four-point star beneath the name */
  const lineY = cy + fontSize * 0.66
  const half = total / 2
  const gap = fontSize * 0.3

  const flourish = (c, color, widthPx) => {
    c.strokeStyle = color
    c.lineWidth = widthPx
    c.beginPath()
    c.moveTo(cx - half, lineY)
    c.lineTo(cx - gap, lineY)
    c.moveTo(cx + gap, lineY)
    c.lineTo(cx + half, lineY)
    c.stroke()

    const s = fontSize * 0.13
    c.fillStyle = color
    c.beginPath()
    c.moveTo(cx, lineY - s)
    c.quadraticCurveTo(cx, lineY, cx + s, lineY)
    c.quadraticCurveTo(cx, lineY, cx, lineY + s)
    c.quadraticCurveTo(cx, lineY, cx - s, lineY)
    c.quadraticCurveTo(cx, lineY, cx, lineY - s)
    c.fill()
  }

  flourish(ctx, 'rgba(240,240,252,0.45)', Math.max(1, H * 0.004))
  flourish(bctx, 'rgba(0,0,0,0.8)', Math.max(1, H * 0.006))

  return { colorCanvas, bumpCanvas }
}
