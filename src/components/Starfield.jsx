import { useEffect, useRef } from 'react'

/**
 * A fixed 2D starfield behind the whole page — tiny twinkling stars
 * that give the site its depth. Lightweight: a single canvas, capped
 * star count, paused when the tab is hidden, and static (no animation)
 * for users who prefer reduced motion.
 */
export default function Starfield({ paused = false }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const reduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches

    let stars = []
    let raf = 0
    let w = 0
    let h = 0

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = window.innerWidth
      h = window.innerHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const count = w < 640 ? 80 : 150
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.3 + 0.3,
        phase: Math.random() * Math.PI * 2,
        speed: 0.4 + Math.random() * 1.2,
        lavender: Math.random() < 0.22,
      }))
      draw(0)
    }

    const draw = (t) => {
      ctx.clearRect(0, 0, w, h)
      for (const s of stars) {
        const twinkle = reduced
          ? 0.65
          : 0.45 + 0.4 * Math.sin(t * 0.001 * s.speed + s.phase)
        ctx.globalAlpha = Math.max(0.08, twinkle)
        ctx.fillStyle = s.lavender ? '#c4b5fd' : '#e6eaf5'
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }

    const loop = (t) => {
      draw(t)
      raf = requestAnimationFrame(loop)
    }

    resize()
    window.addEventListener('resize', resize)
    if (!reduced && !paused) raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
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
