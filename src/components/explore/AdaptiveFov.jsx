import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'

/**
 * Field of view that targets a *horizontal* cone, not a vertical one.
 *
 * A fixed vertical FOV means the experience changes character with the
 * window: 68° vertical on a 16:9 monitor is a 100° horizontal field —
 * wide, immersive, roughly headset-like — but the same 68° on a phone in
 * portrait is a 34° horizontal slot, which feels like looking through a
 * letterbox and is the opposite of presence.
 *
 * So: pick a horizontal target, and derive the vertical FOV from the
 * aspect. Portrait phones get a tall view instead of a narrow one.
 *
 * There is a ceiling, though. Beyond ~115° horizontal the projection
 * stretches at the edges and straight lines bend, which reads as a
 * fisheye lens rather than as presence.
 */
const TARGET_HFOV_DEG = 100
const MAX_VFOV = 74
const MIN_VFOV = 58

export default function AdaptiveFov({ isMobile }) {
  const { camera, size } = useThree()
  const applied = useRef(0)

  useEffect(() => {
    if (!camera) return
    const aspect = size.width / size.height || 1

    // Vertical FOV that produces TARGET_HFOV at this aspect
    const vFromH =
      2 * Math.atan(Math.tan(((TARGET_HFOV_DEG * Math.PI) / 180) / 2) / aspect) *
      (180 / Math.PI)

    let v = Math.min(MAX_VFOV, Math.max(MIN_VFOV, vFromH))

    // Small screens sit closer to the face, so they tolerate a little less
    // vertical sweep before the corners start to smear.
    if (isMobile) v = Math.min(v, 70)

    if (Math.abs(v - applied.current) > 0.05) {
      camera.fov = v
      camera.updateProjectionMatrix()
      applied.current = v
    }
  }, [camera, size.width, size.height, isMobile])

  return null
}
