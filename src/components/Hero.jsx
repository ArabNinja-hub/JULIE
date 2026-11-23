import { Suspense, lazy, useState } from 'react'
import { ChevronDown, Hand, Rocket, Play, Compass } from 'lucide-react'
import { HERO } from '../lib/content'
import { useWebGL } from '../lib/hooks'
import { playUiSound } from '../lib/audio'
import { playSong } from '../lib/song'

// Code-split: the Three.js bundle loads after first paint so the
// page (and its text) appears instantly, even on slow connections.
const MoonScene = lazy(() => import('./MoonScene'))

/** Graceful fallback: a CSS moon if WebGL is unavailable. */
function FallbackMoon() {
  return (
    <div className="fallback-moon" aria-hidden="true">
      <span className="fallback-moon__name">{HERO.name}</span>
    </div>
  )
}

export default function Hero({
  isMobile,
  onEnter,
  hasCinematic,
  onPlayCinematic,
  exploring = false,
}) {
  const webgl = useWebGL()
  const [entering, setEntering] = useState(false)

  /**
   * The ENTER button is the visitor's first real gesture, so it starts
   * the song (browsers require a gesture) and reveals the journey.
   * The music itself lives outside React and keeps playing from here on.
   */
  const launch = () => {
    if (entering) return
    setEntering(true)
    playUiSound('warp')
    playSong({ fade: true })
    onEnter?.()
    setTimeout(() => setEntering(false), 1600)
  }

  return (
    <section className="hero" id="top">
      <div className="hero__moon">
        {webgl ? (
          <Suspense fallback={<FallbackMoon />}>
            <MoonScene isMobile={isMobile} paused={exploring} />
          </Suspense>
        ) : (
          <FallbackMoon />
        )}
      </div>

      <div className="hero__content container">
        <p className="hero__eyebrow">A personal celestial website</p>
        <h1 className="hero__name">{HERO.name}</h1>
        <blockquote className="hero__quote">“{HERO.quote}”</blockquote>
        <p className="hero__subline">{HERO.subline}</p>

        <div className="hero__actions">
          <button
            className="btn btn--primary btn--enter"
            onClick={launch}
            disabled={entering}
          >
            <Rocket size={16} strokeWidth={1.7} />
            {entering ? 'Entering…' : "Enter Juliet's Universe"}
          </button>

          <a href="#journey" className="btn btn--ghost">
            <Compass size={16} strokeWidth={1.7} />
            Scroll the journey
          </a>

          {hasCinematic && (
            <button className="btn btn--ghost" onClick={onPlayCinematic}>
              <Play size={16} strokeWidth={1.7} />
              Play the film
            </button>
          )}
        </div>

        <p className="hero__hint">
          <Hand size={14} strokeWidth={1.5} />
          {HERO.hint}
        </p>
      </div>

      <a href="#about" className="hero__scroll" aria-label="Scroll down">
        <ChevronDown size={22} strokeWidth={1.5} />
      </a>
    </section>
  )
}
