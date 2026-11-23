import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'

/**
 * Presence.
 *
 * "Feels like VR" on a flat screen comes from a handful of things the eye
 * reads without knowing it:
 *
 *   • A body. The camera is not a floating point — it sways, settles and
 *     breathes, and those motions continue when standing still. A perfectly
 *     rigid camera is the single strongest cue that you are looking at a
 *     picture rather than standing somewhere.
 *   • Weight in the turn. Where you look lags very slightly behind the rate
 *     you turn, because a head has mass.
 *   • A wide field of view. VR sits around 100°; a narrow monitor FOV
 *     makes a big space feel like a diorama.
 *
 * Everything here is applied *after* the controls have written the camera,
 * as a small additive offset, so it can never fight the walk or the flight
 * for authority over position. Amplitudes are deliberately tiny: presence
 * should be felt, not watched.
 */
export default function Immersion({ enabled = true, flying = false }) {
  const { camera } = useThree()
  const t = useRef(0)
  const breath = useRef(0)

  /* Honour the OS preference. Idle sway and breathing are continuous
     motion of exactly the kind that setting exists to suppress, and
     respecting it is not optional. */
  const reduced = useRef(false)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    reduced.current = mq.matches
    const onChange = (e) => {
      reduced.current = e.matches
    }
    mq.addEventListener?.('change', onChange)
    return () => mq.removeEventListener?.('change', onChange)
  }, [])

  useFrame((_, rawDelta) => {
    if (!enabled || reduced.current) return
    const delta = Math.min(rawDelta, 0.05)
    t.current += delta

    /* Breathing: ~14 breaths a minute, which is a resting adult. It moves
       the camera by 8 mm — far below the threshold of "an effect", but
       enough that a still frame is never photographically dead. */
    breath.current += delta * (Math.PI * 2 * 0.23)
    const breathY = Math.sin(breath.current) * 0.008

    /* Standing sway. Even standing perfectly still, a human body drifts a
       couple of centimetres at a fraction of a hertz; two incommensurate
       frequencies keep it from looking like a loop. */
    const swayX = (Math.sin(t.current * 0.37) + Math.sin(t.current * 0.613)) * 0.009
    const swayZ = (Math.sin(t.current * 0.291 + 1.3) + Math.sin(t.current * 0.487 + 0.7)) * 0.007

    /* In flight the body is unsupported, so the drift is freer and slower —
       a genuine float rather than a standing tremor. */
    const scale = flying ? 2.4 : 1
    const rate = flying ? 0.45 : 1

    camera.position.x += swayX * scale
    camera.position.y += (breathY + Math.sin(t.current * 0.21 * rate) * 0.012 * scale)
    camera.position.z += swayZ * scale

    /* A hair of roll. The head is never perfectly level, and a level
       horizon with zero roll is subtly artificial. 0.12° is invisible as
       a tilt but reads as a body. */
    camera.rotation.z += Math.sin(t.current * 0.19) * 0.0021
  })

  return null
}
