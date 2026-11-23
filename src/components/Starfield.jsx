import { useEffect, useRef } from 'react'

/**
 * The night sky behind the whole page.
 *
 * Four depth layers of stars. Nearer layers hold larger, brighter, fewer
 * stars and drift faster; the farthest holds hundreds of faint points that
 * barely creep. Stars wrap at the edges, so the drift is endless. Each star
 * twinkles on its own phase, and a slow breathing alpha on the far layer
 * keeps the whole sky from looking frozen.
 *
 * Everything is driven by one requestAnimationFrame loop on a single
 * canvas, capped at ~60fps and paused when the tab is hidden or the
 * explorer takes over. With reduced motion the stars are laid out and drawn
 * once, then left still.
 */

/**
 * Depth layers, far → near.
 *   count    how many stars in the layer
 *   size     pixel radius range
 *   alpha    opacity range
 *   parallax how fast it travels, as a multiple of BASE_DRIFT
 */
const LAYERS = [
  { count: 130, size: [0.32, 0.62], alpha: [0.16, 0.34], parallax: 0.30 },
  { count: 95, size: [0.5, 0.95], alpha: [0.24, 0.46], parallax: 0.62 },
  { count: 48, size: [0.75, 1.3], alpha: [0.32, 0.6], parallax: 1.05 },
  { count: 16, size: [1.1, 1.85], alpha: [0.45, 0.8], parallax: 1.7 },
]

/** Rare bright pins get a faint cross-glow rather than a bigger dot. */
const GLOW_COUNT = { 2: 4, 3: 2 }

const BASE_DRIFT = 4.2 // px per second at parallax 1
const MOBILE_SCALE = 0.6

function makeStar(layer, index, w, h, parallax) {
  const spec = LAYERS[layer]
  const t = Math.random()
  const r = spec.size[0] + (spec.size[1] - spec.size[0]) * t
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    r,
    baseAlpha: spec.alpha[0] + (spec.alpha[1] - spec.alpha[0]) * t,
    parallax,
    // Gentle shared current — the sky is drifting, not falling.
    // A layer's speed is BASE_DRIFT scaled by how near it is, so the far
    // field creeps and the near field glides.
    vx: BASE_DRIFT * parallax,
    vy: BASE_DRIFT * parallax * 0.34,
    // Independent twinkle
    phase: Math.random() * Math.PI * 2,
    speed: 0.5 + Math.random() * 1.5,
    depth: 0.65 + Math.random() * 0.55,
    // Most stars are silver-white; a minority carry the lavender accent
    hue: Math.random() < 0.2 + layer * 0.04 ? '#c4b5fd' : '#e6eaf5',
    glow: Boolean(GLOW_COUNT[layer] && index < GLOW_COUNT[layer]),
  }
}

export default function Starfield({ paused = false }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: true })

    const reduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches

    let stars = []
    let raf = 0
    let w = 0
    let h = 0
    let last = 0
    let running = false

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = window.innerWidth
      h = window.innerHeight
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const scale = w < 640 ? MOBILE_SCALE : 1
      stars = []
      LAYERS.forEach((spec, layer) => {
        const count = Math.max(6, Math.round(spec.count * scale))
        for (let i = 0; i < count; i++) {
          stars.push(makeStar(layer, i, w, h, spec.parallax))
        }
      })
      draw(0)
    }

    /** Redraw the whole field for time `t` in seconds. */
    const draw = (t) => {
      ctx.clearRect(0, 0, w, h)

      // The sky itself is not perfectly still
      const breath = reduced ? 1 : 0.94 + 0.06 * Math.sin(t * 0.22)

      for (const s of stars) {
        // Twinkle in a narrow band, so stars pulse rather than blink out
        const tw = reduced
          ? 1
          : 0.78 + 0.22 * Math.sin(t * s.speed * 1.7 + s.phase)

        const a = s.baseAlpha * tw * breath
        if (a <= 0.01) continue

        ctx.globalAlpha = a
        ctx.fillStyle = s.hue
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fill()

        // A handful of pins get a soft glow so the sky has anchors
        if (s.glow && !reduced) {
          ctx.globalAlpha = a * 0.24
          ctx.beginPath()
          ctx.arc(s.x, s.y, s.r * 3.4, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      ctx.globalAlpha = 1
    }

    /** Move the stars, wrapping at the edges so the drift never ends. */
    const advance = (dt) => {
      const pad = 4
      for (const s of stars) {
        s.x += s.vx * s.depth * dt
        s.y += s.vy * s.depth * dt

        if (s.x > w + pad) {
          s.x = -pad
          s.y = Math.random() * h
        } else if (s.x < -pad) {
          s.x = w + pad
          s.y = Math.random() * h
        }
        if (s.y > h + pad) {
          s.y = -pad
          s.x = Math.random() * w
        } else if (s.y < -pad) {
          s.y = h + pad
          s.x = Math.random() * w
        }
      }
    }

    const loop = (now) => {
      // Seconds since the last frame, clamped so a backgrounded tab that
      // resumes does not teleport every star across the screen.
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0
      last = now
      advance(dt)
      draw(now / 1000)
      raf = requestAnimationFrame(loop)
    }

    const start = () => {
      if (running || paused || reduced) return
      running = true
      last = 0
      raf = requestAnimationFrame(loop)
    }

    const stop = () => {
      running = false
      cancelAnimationFrame(raf)
    }

    resize()
    window.addEventListener('resize', resize)

    // Paint once immediately, even before the loop gets going
    draw(0)

    if (paused) {
      // The explorer has its own sky; hold a still, dimmed backdrop
      canvas.classList.add('starfield--paused')
    } else if (reduced) {
      // Reduced motion: the field is already painted, and start() refuses
      // to run, so the stars stay exactly where they are. Nothing moves.
      canvas.classList.remove('starfield--paused')
    } else {
      start()
    }

    /* Pause while the tab is hidden — no point burning a frame budget on
       stars nobody is looking at, and it stops the clock jumping on return. */
    const onVisibility = () => {
      if (document.hidden) stop()
      else start()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      stop()
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [paused])

  return (
    <canvas
      ref={canvasRef}
      className={`starfield ${paused ? 'starfield--paused' : ''}`}
      aria-hidden="true"
    />
  )
}
