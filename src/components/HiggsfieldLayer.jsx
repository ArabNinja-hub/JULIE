import { useEffect, useRef, useState } from 'react'
import { Film, X } from 'lucide-react'
import { playUiSound } from '../lib/audio'

/**
 * ============================================================
 *  HIGGSFIELD CINEMATIC LAYER (optional visual layer)
 * ============================================================
 *
 *  Drop the generated video at:
 *
 *      public/video/moon-cinematic.mp4
 *      (optional poster frame: public/video/moon-cinematic.jpg)
 *
 *  Requirements for the asset — it must:
 *    • loop seamlessly (first and last frames match)
 *    • have no camera cuts or sudden movements
 *    • match the site palette: midnight navy, blue-silver moon,
 *      soft lavender highlights
 *    • be ~6–12 s long, H.264 MP4, 1920×1080, under ~6 MB
 *
 *  Until the file exists, the component checks for it and simply
 *  doesn't render, so the 3D moon remains the hero. The button that
 *  opens this layer is hidden until the asset is present — no dead
 *  buttons anywhere in the experience.
 */

const VIDEO_SRC = '/video/moon-cinematic.mp4'
const POSTER_SRC = '/video/moon-cinematic.jpg'

export function useHiggsfieldAsset() {
  const [available, setAvailable] = useState(false)

  useEffect(() => {
    let cancelled = false
    // A HEAD request keeps this free: no video bytes until she opens it.
    fetch(VIDEO_SRC, { method: 'HEAD' })
      .then((res) => {
        if (cancelled) return
        const type = res.headers.get('content-type') || ''
        setAvailable(res.ok && type.startsWith('video'))
      })
      .catch(() => {
        if (!cancelled) setAvailable(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return available
}

export default function HiggsfieldLayer({ open, onClose }) {
  const videoRef = useRef(null)
  const [muted, setMuted] = useState(true)

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (open) {
      v.currentTime = 0
      const p = v.play()
      if (p && p.catch) p.catch(() => {})
    } else {
      v.pause()
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="cine"
      role="dialog"
      aria-label="Cinematic moon film"
      onClick={onClose}
    >
      <div className="cine__frame" onClick={(e) => e.stopPropagation()}>
        <video
          ref={videoRef}
          className="cine__video"
          src={VIDEO_SRC}
          poster={POSTER_SRC}
          loop
          muted={muted}
          playsInline
          preload="none"
        />
        <div className="cine__bar">
          <p className="cine__label">
            <Film size={13} strokeWidth={1.6} />
            Cinematic layer · generated with Higgsfield
          </p>
          <div className="cine__actions">
            <button
              className="cine__btn"
              onClick={() => {
                setMuted((m) => !m)
                playUiSound('click')
              }}
              aria-pressed={!muted}
            >
              {muted ? 'Unmute' : 'Mute'}
            </button>
            <button className="cine__btn" onClick={onClose} aria-label="Close film">
              <X size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
