import { useEffect, useRef, useState } from 'react'
import {
  X,
  Compass,
  MapPin,
  Sparkles,
  ChevronRight,
  Keyboard,
  MousePointer2,
  Hand,
  Check,
  Lightbulb,
  Footprints,
} from 'lucide-react'
import { DESTINATIONS, destinationById } from '../../lib/destinations'

/* ---------------- Destination picker ---------------- */

export function DestinationPanel({
  current,
  foundCount,
  totalLandmarks,
  onSelect,
  onClose,
}) {
  return (
    <aside className="explore-panel">
      <div className="explore-panel__head">
        <p className="explore-panel__eyebrow">
          <Compass size={13} strokeWidth={1.6} />
          Lunar map
        </p>
        <h2 className="explore-panel__title">Choose a destination</h2>
        <p className="explore-panel__sub">
          {foundCount} of {totalLandmarks} discoveries logged
        </p>
      </div>

      <ul className="dest-list">
        {DESTINATIONS.map((d, i) => {
          const isCurrent = d.id === current.id
          return (
            <li key={d.id}>
              <button
                className={`dest ${isCurrent ? 'dest--active' : ''}`}
                onClick={() => onSelect(d.id)}
                aria-current={isCurrent ? 'true' : undefined}
              >
                <span className="dest__index">0{i + 1}</span>
                <span className="dest__body">
                  <span className="dest__name">{d.name}</span>
                  <span className="dest__latin">{d.latin}</span>
                  <span className="dest__coords">{d.coords}</span>
                </span>
                <span className="dest__go">
                  {isCurrent ? <Check size={16} /> : <ChevronRight size={16} />}
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      <div className="explore-panel__foot">
        <p className="explore-controls">
          <span>
            <Keyboard size={13} /> WASD / arrows
          </span>
          <span>
            <MousePointer2 size={13} /> drag to look
          </span>
          <span>
            <Hand size={13} /> click a beacon
          </span>
        </p>
        <button className="btn btn--ghost btn--sm" onClick={onClose}>
          Back to the site
        </button>
      </div>
    </aside>
  )
}

/* ---------------- Destination brief ---------------- */

export function LocationBrief({ destination, onFindNext, onOpenMap }) {
  const [expanded, setExpanded] = useState(false)
  const idle = useRef(false)
  const timer = useRef(0)

  useEffect(() => {
    setExpanded(false)
    idle.current = false
    clearTimeout(timer.current)
    // Nudge the brief open once, then let her tuck it away for good
    timer.current = setTimeout(() => {
      if (!idle.current) setExpanded(true)
    }, 2600)
    return () => clearTimeout(timer.current)
  }, [destination.id])

  const close = () => {
    idle.current = true
    setExpanded(false)
  }

  return (
    <div className={`brief ${expanded ? 'brief--expanded' : ''}`}>
      <button
        className="brief__header"
        onClick={() => {
          if (expanded) close()
          else {
            idle.current = true
            setExpanded(true)
          }
        }}
        aria-expanded={expanded}
      >
        <span className="brief__marker">
          <MapPin size={15} strokeWidth={1.6} />
        </span>
        <span className="brief__titles">
          <span className="brief__name">{destination.name}</span>
          <span className="brief__coords">{destination.coords}</span>
        </span>
        <span className="brief__toggle">
          {expanded ? 'Less' : 'More'}
        </span>
      </button>

      <div className="brief__body">
        <p className="brief__tagline">{destination.tagline}</p>
        <p className="brief__desc">{destination.description}</p>

        <ul className="brief__facts">
          {destination.facts.map((f) => (
            <li key={f}>
              <Lightbulb size={12} strokeWidth={1.6} />
              {f}
            </li>
          ))}
        </ul>

        <div className="brief__actions">
          <button className="btn btn--primary btn--sm" onClick={onFindNext}>
            <Sparkles size={14} /> Find the next discovery
          </button>
          <button className="btn btn--ghost btn--sm" onClick={onOpenMap}>
            <Compass size={14} /> Map
          </button>
        </div>
      </div>
    </div>
  )
}

/* ---------------- Discovery card ---------------- */

export function DiscoveryCard({ landmark, onClose, isNew }) {
  if (!landmark) return null

  return (
    <div className="discovery" role="dialog" aria-label={landmark.name}>
      <div className={`discovery__pulse ${isNew ? 'is-new' : ''}`} aria-hidden="true" />
      <div className="discovery__card">
        <button
          className="discovery__close"
          onClick={onClose}
          aria-label="Close discovery"
        >
          <X size={16} />
        </button>

        <p className="discovery__eyebrow">
          <Footprints size={13} strokeWidth={1.6} />
          {isNew ? 'New discovery' : 'Discovery logged'}
        </p>
        <h3 className="discovery__title">{landmark.name}</h3>
        <p className="discovery__desc">{landmark.description}</p>

        <div className="discovery__facts">
          <p className="discovery__facts-title">Field notes</p>
          <ul>
            {landmark.facts.map((f) => (
              <li key={f}>
                <span className="discovery__bullet" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        <div className="discovery__sparkles" aria-hidden="true">
          {Array.from({ length: 7 }).map((_, i) => (
            <span key={i} style={{ '--i': i }} />
          ))}
        </div>
      </div>
    </div>
  )
}

/* ---------------- Compass strip ---------------- */

// Sixteen points keep the readout honest between compass ticks
const POINTS = [
  'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
]

export function CompassStrip({ heading }) {
  // yaw 0 faces -Z (north). Convert to a 0–360 heading.
  const deg = ((-heading * 180) / Math.PI + 360) % 360
  const label = POINTS[Math.round(deg / 22.5) % 16]

  return (
    <div className="compass" aria-hidden="true">
      <span className="compass__tick" />
      <span className="compass__label">
        {label} · {Math.round(deg)}°
      </span>
    </div>
  )
}

/* ---------------- Exit ---------------- */

export function ExitButton({ onExit }) {
  return (
    <button className="explore-exit" onClick={onExit}>
      <X size={15} strokeWidth={1.8} />
      Exit
    </button>
  )
}

export function destinationName(id) {
  return destinationById(id).name
}
