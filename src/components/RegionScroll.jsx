import { useEffect, useRef, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { DESTINATIONS } from '../lib/destinations'
import { REGION_SCROLL } from '../lib/content'
import { playUiSound } from '../lib/audio'

/**
 * SCROLL-BASED REGION TRANSITION
 *
 * A cinematic, sticky band: as she scrolls, the lunar horizon slides
 * through the four regions while their details fade in and out. It
 * complements the interactive world rather than replacing it — every
 * region here has a "Walk here" button that opens the real 3D scene.
 */
export default function RegionScroll({ onExploreAt }) {
  const ref = useRef(null)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    let frame = 0
    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        const el = ref.current
        if (!el) return
        const rect = el.getBoundingClientRect()
        const total = rect.height - window.innerHeight
        if (total <= 0) return
        const p = Math.min(1, Math.max(0, -rect.top / total))
        setProgress(p)
      })
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  const count = DESTINATIONS.length
  // Segment 0 = intro title, then one segment per region
  const raw = progress * count
  const active = Math.min(count - 1, Math.floor(raw))
  const local = raw - active

  return (
    <section className="region-scroll" ref={ref} id="journey">
      <div className="region-scroll__sticky">
        {/* Drifting horizon layers */}
        <div className="region-sky" aria-hidden="true">
          <div
            className="region-sky__glow"
            style={{ transform: `translateY(${progress * -60}px)` }}
          />
          <div className="region-sky__stars" />
        </div>

        <div
          className="region-horizon"
          aria-hidden="true"
          style={{
            transform: `translateY(${6 - progress * 10}%) scale(${1.06 + progress * 0.05})`,
          }}
        >
          <svg viewBox="0 0 1200 320" preserveAspectRatio="none">
            <defs>
              <linearGradient id="ridgeA" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2c3a5e" />
                <stop offset="100%" stopColor="#0a0f1f" />
              </linearGradient>
              <linearGradient id="ridgeB" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4d5c85" />
                <stop offset="100%" stopColor="#131a2e" />
              </linearGradient>
            </defs>
            <path
              d="M0,240 C120,190 190,215 300,175 C400,140 470,200 560,170 C660,135 720,195 830,165 C930,138 1010,190 1100,160 C1150,145 1180,155 1200,150 L1200,320 L0,320 Z"
              fill="url(#ridgeA)"
            />
            <path
              d="M0,275 C140,240 230,258 350,232 C460,208 540,250 650,228 C760,206 840,246 960,224 C1060,206 1130,232 1200,220 L1200,320 L0,320 Z"
              fill="url(#ridgeB)"
            />
          </svg>
        </div>

        <div className="container region-content">
          <div className="region-intro" style={{ opacity: Math.max(0, 1 - raw * 1.6) }}>
            <p className="eyebrow">{REGION_SCROLL.eyebrow}</p>
            <h2 className="section-title">{REGION_SCROLL.title}</h2>
            <p className="section-intro">{REGION_SCROLL.intro}</p>
            <p className="region-scroll__hint">Keep scrolling to travel the Moon</p>
          </div>

          {DESTINATIONS.map((d, i) => {
            const visible = i === active
            const fade = Math.min(1, local * 3, (1 - local) * 3)
            return (
              <article
                key={d.id}
                className={`region-card ${visible ? 'is-active' : ''}`}
                style={{
                  opacity: visible ? Math.max(0.15, fade) : 0,
                  transform: `translateY(${visible ? (1 - fade) * 24 : 24}px)`,
                  pointerEvents: visible ? 'auto' : 'none',
                }}
                aria-hidden={!visible}
              >
                <p className="region-card__index">
                  Region 0{i + 1} / 0{count}
                </p>
                <h3 className="region-card__name">{d.name}</h3>
                <p className="region-card__latin">{d.latin}</p>
                <p className="region-card__coords">{d.coords}</p>
                <p className="region-card__desc">{d.description}</p>
                <button
                  className="btn btn--primary btn--sm"
                  onClick={() => {
                    playUiSound('click')
                    onExploreAt(d.id)
                  }}
                >
                  Walk here <ChevronRight size={14} />
                </button>
              </article>
            )
          })}

          {/* Progress rail */}
          <div className="region-rail" aria-hidden="true">
            {DESTINATIONS.map((d, i) => (
              <span
                key={d.id}
                className={`region-rail__dot ${i === active ? 'is-active' : ''}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
