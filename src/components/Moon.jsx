import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { createMoonTextures } from '../lib/moonTexture'

/**
 * The 3D moon.
 *
 * A sphere carrying two procedurally generated maps from the same
 * heightfield: the colour map (shaded in the texture) and the bump map
 * (raw heights). The real-time key light rakes across the bump, so the
 * craters catch light and throw shadow as the moon turns — the lettering
 * is engraved in both maps, so it is genuinely part of the surface.
 *
 * Rotates slowly and continuously on its vertical axis, and drifts on a
 * gentle sine, like something hanging in the dark.
 */
export default function Moon({ isMobile = false, reducedMotion = false }) {
  const meshRef = useRef()

  /* The surface is built at a modest size first, then refined. Generating
     the full 2048 map takes a couple of seconds of main-thread work; doing
     that before the first render leaves an empty stage. So we show the
     1024 version immediately (fast, and already sharp on a phone), then
     swap in the high-resolution maps once the browser is idle. */
  const [detail, setDetail] = useState(isMobile ? 'base' : 'base')

  const { colorTex, bumpTex } = useMemo(() => {
    const width = detail === 'high' ? 2048 : 1024
    const { colorCanvas, bumpCanvas } = createMoonTextures({ width })

    const colorTex = new THREE.CanvasTexture(colorCanvas)
    colorTex.colorSpace = THREE.SRGBColorSpace
    colorTex.anisotropy = isMobile ? 4 : 8
    colorTex.wrapS = THREE.RepeatWrapping

    const bumpTex = new THREE.CanvasTexture(bumpCanvas)
    bumpTex.anisotropy = isMobile ? 4 : 8
    bumpTex.wrapS = THREE.RepeatWrapping

    return { colorTex, bumpTex }
  }, [isMobile, detail])

  // Refine to full resolution once the page has settled.
  useEffect(() => {
    if (isMobile) return undefined
    let cancelled = false
    const start = () => {
      // A second idle callback would be cleaner still, but this is enough:
      // by the time the outer one fires the hero has already painted.
      window.requestIdleCallback?.(
        () => {
          if (!cancelled) setDetail('high')
        },
        { timeout: 2500 }
      ) ?? setTimeout(() => {
        if (!cancelled) setDetail('high')
      }, 2500)
    }
    start()
    return () => {
      cancelled = true
    }
  }, [isMobile])

  useEffect(
    () => () => {
      colorTex.dispose()
      bumpTex.dispose()
    },
    [colorTex, bumpTex]
  )

  useFrame((state, delta) => {
    if (!meshRef.current) return
    if (!reducedMotion) {
      // Slow, continuous rotation around the vertical axis
      meshRef.current.rotation.y += delta * 0.042
      // Gentle drift — barely perceptible, like a held breath
      meshRef.current.position.y =
        Math.sin(state.clock.elapsedTime * 0.32) * 0.055
    }
  })

  return (
    <mesh ref={meshRef} rotation={[0.05, 0, 0.02]}>
      <sphereGeometry args={[1.55, isMobile ? 56 : 96, isMobile ? 36 : 64]} />
      <meshStandardMaterial
        map={colorTex}
        bumpMap={bumpTex}
        bumpScale={1.15}
        roughness={0.94}
        metalness={0.04}
        envMapIntensity={0.35}
      />
    </mesh>
  )
}
