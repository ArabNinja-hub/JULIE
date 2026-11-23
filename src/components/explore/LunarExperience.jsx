import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import { Compass, Map as MapIcon, Rocket, ArrowUp, ArrowDown } from 'lucide-react'
import { DESTINATIONS, LANDMARKS, destinationById } from '../../lib/destinations'
import { playUiSound } from '../../lib/audio'
import {
  DestinationPanel,
  LocationBrief,
  DiscoveryCard,
  CompassStrip,
  ExitButton,
} from './ExploreHud'
import Joystick from './Joystick'

const ExploreScene = lazy(() => import('./ExploreScene'))

/**
 * LUNAR EXPLORATION — the main feature.
 *
 * Owns all exploration state: which destination she's standing in, which
 * landmarks she has found (persisted), and which discovery card is open.
 * The 3D world streams in lazily; the HUD is instant.
 */
export default function LunarExperience({
  onExit,
  isMobile,
  reducedMotion,
  initialDestination,
}) {
  const api = useRef(null)
  const [destinationId, setDestinationId] = useState(
    initialDestination || DESTINATIONS[0].id
  )
  const [activeLandmark, setActiveLandmark] = useState(null)
  const [newLandmark, setNewLandmark] = useState(null)
  const [found, setFound] = useState(() => {
    try {
      const raw = localStorage.getItem('juliet.discoveries')
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  })
  const [showMap, setShowMap] = useState(!initialDestination)
  const [compass, setCompass] = useState(0)
  const [showIntro, setShowIntro] = useState(true)
  const [ready, setReady] = useState(false)
  const [nearby, setNearby] = useState(null)
  const [paused, setPaused] = useState(
    typeof document !== 'undefined' ? document.hidden : false
  )
  const [flying, setFlying] = useState(false)
  const [altitude, setAltitude] = useState(0)

  const destination = destinationById(destinationId)
  const entryRef = useRef(destinationById(initialDestination || DESTINATIONS[0].id))

  /* ---------- persist discoveries ---------- */
  useEffect(() => {
    try {
      localStorage.setItem('juliet.discoveries', JSON.stringify(found))
    } catch {
      /* storage may be unavailable — discoveries still work this session */
    }
  }, [found])

  /* ---------- body scroll lock while exploring ---------- */
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  /* ---------- spawn ---------- */
  useEffect(() => {
    const timer = setTimeout(() => {
      setReady(true)
      const entry = entryRef.current
      if (api.current) {
        api.current.teleport(
          entry.spawn.x,
          entry.spawn.z,
          entry.spawn.lookX,
          entry.spawn.lookZ,
          true
        )
      }
    }, 60)
    return () => clearTimeout(timer)
    // Spawn only once, at the opening destination
  }, [])

  /* ---------- pause the render loop when the tab is hidden ---------- */
  useEffect(() => {
    const onVisibility = () => setPaused(document.hidden)
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  /* ---------- compass + altitude updates ----------
   * Polled rather than pushed from the render loop: the 3D code should not
   * know a HUD exists, and 8 updates a second is below the threshold where
   * a readout looks steppy.
   */
  useEffect(() => {
    if (!ready) return
    const id = setInterval(() => {
      if (!api.current) return
      const st = api.current.getState()
      setCompass(st.yaw)
      setFlying(st.flying)
      setAltitude(st.alt)
    }, 120)
    return () => clearInterval(id)
  }, [ready])

  const toggleFlight = useCallback(() => {
    if (!api.current) return
    api.current.toggleFlight()
    playUiSound('warp')
  }, [])

  /* ---------- navigation ---------- */
  const travelTo = useCallback(
    (id) => {
      const next = destinationById(id)
      setDestinationId(id)
      setActiveLandmark(null)
      setNewLandmark(null)
      setNearby(null)
      setShowMap(false)
      if (api.current) {
        api.current.teleport(
          next.spawn.x,
          next.spawn.z,
          next.spawn.lookX,
          next.spawn.lookZ,
          reducedMotion
        )
      }
      playUiSound('warp')
    },
    [reducedMotion]
  )

  const selectLandmark = useCallback(
    (id) => {
      const landmark = LANDMARKS.find((l) => l.id === id)
      if (!landmark) return
      setActiveLandmark(id)
      const isNew = !found.includes(id)
      setNewLandmark(isNew ? id : null)
      if (isNew) {
        setFound((prev) => [...prev, id])
        playUiSound('discover')
      } else {
        playUiSound('open')
      }
    },
    [found]
  )

  const findNext = useCallback(() => {
    const here = LANDMARKS.filter((l) => l.destination === destinationId)
    const next = here.find((l) => !found.includes(l.id)) || here[0]
    if (!next) return
    if (api.current) {
      // Stand a short distance from the marker and look at it
      const [mx, mz] = next.position
      const angle = Math.atan2(mz - destination.spawn.z, mx - destination.spawn.x)
      const sx = mx - Math.cos(angle) * 14
      const sz = mz - Math.sin(angle) * 14
      api.current.teleport(sx, sz, mx, mz, reducedMotion)
    }
    playUiSound('click')
  }, [destinationId, found, reducedMotion, destination.spawn])

  /* ---------- escape to exit / close ---------- */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (activeLandmark) setActiveLandmark(null)
        else if (showIntro) setShowIntro(false)
        else onExit()
      }
      if (e.key.toLowerCase() === 'm') setShowMap((v) => !v)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activeLandmark, showIntro, onExit])

  /* Marker proximity — drives a "tap to log this" prompt in the HUD */
  const handleNearby = useCallback((marker) => {
    setNearby(marker)
  }, [])

  const active = activeLandmark
    ? LANDMARKS.find((l) => l.id === activeLandmark)
    : null

  return (
    <div
      className="explore"
      role="dialog"
      aria-modal="true"
      aria-label="Lunar exploration"
    >
      <div className="explore__canvas">
        <Suspense fallback={null}>
          <ExploreScene
            api={api}
            isMobile={isMobile}
            destinationId={destinationId}
            foundLandmarks={found}
            onSelectLandmark={selectLandmark}
            onNearby={handleNearby}
            onStep={() => playUiSound('step')}
            paused={paused}
            flying={flying}
          />
        </Suspense>
      </div>

      {/* Cinematic letterbox + vignette */}
      <div className="explore__vignette" aria-hidden="true" />

      {/* Top bar */}
      <div className="explore__top">
        <div className="explore__badge">
          <Compass size={14} strokeWidth={1.6} />
          <span>Lunar exploration</span>
        </div>
        <CompassStrip heading={compass} />
        <ExitButton onExit={onExit} />
      </div>

      {/* Map toggle on mobile */}
      <button
        className="explore__map-toggle"
        onClick={() => {
          setShowMap((v) => !v)
          playUiSound('click')
        }}
        aria-label="Toggle lunar map"
      >
        <MapIcon size={16} strokeWidth={1.7} />
        <span>{showMap ? 'Hide map' : 'Map'}</span>
      </button>

      {/* Destination panel */}
      {showMap && (
        <DestinationPanel
          current={destination}
          foundCount={found.length}
          totalLandmarks={LANDMARKS.length}
          onSelect={travelTo}
          onClose={onExit}
        />
      )}

      {/* Location brief */}
      {!showMap && (
        <LocationBrief
          destination={destination}
          onFindNext={findNext}
          onOpenMap={() => setShowMap(true)}
        />
      )}

      {/* Touch controls */}
      {isMobile && (
        <Joystick onMove={(x, y) => api.current && api.current.setMove(x, y)} />
      )}

      {/* Flight control — the same button on every device, because lifting
          off is the one action a first-time visitor should not have to
          discover a keyboard shortcut for. */}
      <div className="flight-ctl">
        <button
          className={`flight-ctl__toggle${flying ? ' is-flying' : ''}`}
          onClick={toggleFlight}
          aria-pressed={flying}
          aria-label={flying ? 'Land' : 'Lift off'}
        >
          <Rocket size={15} strokeWidth={1.7} />
          <span>{flying ? 'Land' : 'Lift off'}</span>
        </button>

        {flying && (
          <div className="flight-ctl__alt">
            <div className="flight-ctl__readout">
              <span className="flight-ctl__value">{Math.round(altitude)}</span>
              <span className="flight-ctl__unit">m up</span>
            </div>
            {/* Hold to climb or descend — the same axis the keyboard
                drives, so touch and keys share one behaviour. */}
            <button
              className="flight-ctl__axis"
              onPointerDown={() => api.current?.setFlyAxis(1)}
              onPointerUp={() => api.current?.setFlyAxis(0)}
              onPointerLeave={() => api.current?.setFlyAxis(0)}
              aria-label="Climb"
            >
              <ArrowUp size={16} strokeWidth={1.9} />
            </button>
            <button
              className="flight-ctl__axis"
              onPointerDown={() => api.current?.setFlyAxis(-1)}
              onPointerUp={() => api.current?.setFlyAxis(0)}
              onPointerLeave={() => api.current?.setFlyAxis(0)}
              aria-label="Descend"
            >
              <ArrowDown size={16} strokeWidth={1.9} />
            </button>
          </div>
        )}
      </div>

      {/* Proximity prompt */}
      {nearby && !activeLandmark && (
        <button
          className="nearby-prompt"
          onClick={() => selectLandmark(nearby.id)}
        >
          <span className="nearby-prompt__dot" />
          {found.includes(nearby.id) ? 'Revisit' : 'Discover'}: {nearby.name}
        </button>
      )}

      {/* Discovery card */}
      <DiscoveryCard
        landmark={active}
        isNew={newLandmark === activeLandmark}
        onClose={() => setActiveLandmark(null)}
      />

      {/* First-visit instructions */}
      {showIntro && (
        <div className="explore-intro" role="dialog" aria-label="How to explore">
          <div className="explore-intro__card">
            <p className="eyebrow">Welcome, explorer</p>
            <h2>The Moon is yours to walk</h2>
            <p>
              {isMobile
                ? 'Use the joystick to walk and drag anywhere to look around. Hold Lift to rise above the surface and see the whole landscape from the air.'
                : 'Move with W A S D or the arrow keys. Drag to look around. Press F to lift off, then Space and Shift to climb and descend. Press M for the lunar map.'}
            </p>
            <div className="explore-intro__marks">
              <span>{isMobile ? 'Joystick' : 'WASD'}</span>
              <span>{isMobile ? 'Hold Lift' : 'F to fly'}</span>
              <span>Drag to look</span>
              <span>Esc to exit</span>
            </div>
            <button
              className="btn btn--primary"
              onClick={() => {
                setShowIntro(false)
                playUiSound('open')
              }}
            >
              Begin exploring
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
