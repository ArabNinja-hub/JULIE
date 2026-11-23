import { useEffect, useRef, useState } from 'react'
import {
  Play,
  Pause,
  Volume2,
  Volume1,
  VolumeX,
  Music2,
  AlertCircle,
  ChevronDown,
} from 'lucide-react'
import { useSong } from '../lib/hooks'
import {
  TRACK,
  playSong,
  pauseSong,
  toggleMute,
  setVolume,
  seekTo,
} from '../lib/song'

function clock(seconds) {
  if (!seconds || !Number.isFinite(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * Floating music player.
 *
 * Purely a view onto the single audio element in lib/song.js — mounting
 * or unmounting this component never touches playback. Collapses to a
 * small disc on phones so it never fights the lunar HUD or the joystick.
 */
export default function MusicPlayer() {
  const song = useSong()
  const [open, setOpen] = useState(true)
  const [dismissedError, setDismissedError] = useState(false)
  const [scrubbing, setScrubbing] = useState(false)
  const [localTime, setLocalTime] = useState(0)
  const prevError = useRef(null)

  // Re-open the panel if a new error appears after she collapsed it
  useEffect(() => {
    if (song.error && song.error !== prevError.current) {
      setDismissedError(false)
      setOpen(true)
    }
    prevError.current = song.error
  }, [song.error])

  // Collapse by default on phones once the point is made
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 560) {
      const t = setTimeout(() => setOpen(false), 6000)
      return () => clearTimeout(t)
    }
  }, [])

  const progress = song.duration
    ? ((scrubbing ? localTime : song.currentTime) / song.duration) * 100
    : 0

  const VolIcon =
    song.muted || song.volume === 0
      ? VolumeX
      : song.volume < 0.45
        ? Volume1
        : Volume2

  /* Collapsed disc — always reachable, never in the way */
  if (!open) {
    return (
      <button
        className={`player player--mini ${song.playing ? 'is-playing' : ''}`}
        onClick={() => setOpen(true)}
        aria-label={`Open music player — ${TRACK.title}`}
      >
        <span className="player__mini-disc">
          <Music2 size={17} strokeWidth={1.7} />
          {song.playing && <span className="player__mini-ring" aria-hidden="true" />}
        </span>
      </button>
    )
  }

  return (
    <aside className="player" aria-label="Music player">
      <div className="player__inner">
        {/* Header */}
        <div className="player__head">
          <span className={`player__disc ${song.playing ? 'is-spinning' : ''}`}>
            <Music2 size={14} strokeWidth={1.7} />
            <span className="player__disc-hole" />
          </span>

          <div className="player__meta">
            <p className="player__label">Now playing</p>
            <p className="player__title" title={`${TRACK.title} — ${TRACK.artist}`}>
              {TRACK.title}
            </p>
            <p className="player__artist">{TRACK.artist}</p>
          </div>

          <button
            className="player__collapse"
            onClick={() => setOpen(false)}
            aria-label="Collapse music player"
          >
            <ChevronDown size={15} />
          </button>
        </div>

        {/* Progress — click or drag to seek */}
        <div className="player__timeline">
          <span className="player__time">
            {clock(scrubbing ? localTime : song.currentTime)}
          </span>
          <div
            className="player__bar"
            role="slider"
            tabIndex={0}
            aria-label="Seek"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress)}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId)
              const rect = e.currentTarget.getBoundingClientRect()
              const t = ((e.clientX - rect.left) / rect.width) * song.duration
              setScrubbing(true)
              setLocalTime(Math.max(0, Math.min(song.duration, t)))
            }}
            onPointerMove={(e) => {
              if (!scrubbing) return
              const rect = e.currentTarget.getBoundingClientRect()
              const t = ((e.clientX - rect.left) / rect.width) * song.duration
              setLocalTime(Math.max(0, Math.min(song.duration, t)))
            }}
            onPointerUp={() => {
              if (song.duration) seekTo(localTime / song.duration)
              setScrubbing(false)
            }}
            onKeyDown={(e) => {
              if (!song.duration) return
              if (e.key === 'ArrowRight') {
                seekTo(Math.min(1, (song.currentTime + 5) / song.duration))
              }
              if (e.key === 'ArrowLeft') {
                seekTo(Math.max(0, (song.currentTime - 5) / song.duration))
              }
            }}
          >
            <span className="player__bar-fill" style={{ width: `${progress}%` }} />
            <span className="player__bar-knob" style={{ left: `${progress}%` }} />
          </div>
          <span className="player__time player__time--total">
            {clock(song.duration)}
          </span>
        </div>

        {/* Controls */}
        <div className="player__controls">
          <button
            className="player__play"
            onClick={() => {
              if (song.playing) pauseSong()
              else playSong({ fade: !song.started })
            }}
            aria-label={song.playing ? 'Pause music' : 'Play music'}
            aria-pressed={song.playing}
          >
            {song.playing ? (
              <Pause size={16} strokeWidth={2} fill="currentColor" />
            ) : (
              <Play size={16} strokeWidth={2} fill="currentColor" />
            )}
          </button>

          <button
            className="player__mute"
            onClick={toggleMute}
            aria-label={song.muted ? 'Unmute music' : 'Mute music'}
            aria-pressed={song.muted}
          >
            <VolIcon size={16} strokeWidth={1.7} />
          </button>

          <input
            className="player__volume"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={song.muted ? 0 : song.volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            aria-label="Volume"
            style={{ '--vol': `${(song.muted ? 0 : song.volume) * 100}%` }}
          />

          <span className="player__status" aria-live="polite">
            {song.loading
              ? 'Loading…'
              : song.playing
                ? 'Playing'
                : song.started
                  ? 'Paused'
                  : 'Ready'}
          </span>
        </div>

        {/* Errors, handled in place rather than thrown */}
        {song.error && !dismissedError && (
          <p className="player__error" role="status">
            <AlertCircle size={13} />
            <span>{song.error}</span>
            <button
              onClick={() => setDismissedError(true)}
              aria-label="Dismiss message"
            >
              ×
            </button>
          </p>
        )}
      </div>
    </aside>
  )
}
