import { useEffect, useMemo, useRef } from 'react'
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

  const { colorTex, bumpTex } = useMemo(() => {
    const { colorCanvas, bumpCanvas } = createMoonTextures({
      width: isMobile ? 1024 : 2048,
    })

    const colorTex = new THREE.CanvasTexture(colorCanvas)
    colorTex.colorSpace = THREE.SRGBColorSpace
    colorTex.anisotropy = isMobile ? 4 : 8
    colorTex.wrapS = THREE.RepeatWrapping

    const bumpTex = new THREE.CanvasTexture(bumpCanvas)
    bumpTex.anisotropy = isMobile ? 4 : 8
    bumpTex.wrapS = THREE.RepeatWrapping

    return { colorTex, bumpTex }
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
