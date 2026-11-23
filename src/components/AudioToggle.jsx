import { useEffect, useState } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import { toggleAmbient, playUiSound } from '../lib/audio'
import { useAudioEnabled } from '../lib/hooks'

/**
 * Ambient sound toggle. Muted by default, never autoplays —
 * the AudioContext is only created on the user's first click.
 */
export default function AudioToggle() {
  const enabled = useAudioEnabled()
  const [firstVisit, setFirstVisit] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setFirstVisit(false), 9000)
    return () => clearTimeout(t)
  }, [])

  return (
    <button
      className={`audio-toggle ${enabled ? 'is-on' : ''} ${
        firstVisit && !enabled ? 'is-hinting' : ''
      }`}
      onClick={async () => {
        const on = await toggleAmbient()
        if (on) playUiSound('open')
      }}
      aria-pressed={enabled}
      aria-label={enabled ? 'Mute ambient sound' : 'Enable ambient sound'}
      title={enabled ? 'Mute ambient sound' : 'Enable ambient sound'}
    >
      <span className="audio-toggle__icon">
        {enabled ? (
          <Volume2 size={17} strokeWidth={1.7} />
        ) : (
          <VolumeX size={17} strokeWidth={1.7} />
        )}
      </span>
      <span className="audio-toggle__label">
        {enabled ? 'Sound on' : 'Sound off'}
      </span>
      {enabled && (
        <span className="audio-toggle__bars" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      )}
    </button>
  )
}
