import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { SUN_DIRECTION } from '../../lib/terrain'

/**
 * Shadow bias, derived rather than guessed.
 *
 * A shadow map stores depth at grid resolution, so along the light
 * direction it can be wrong by roughly `texelSize / tan(sunElevation)`.
 * If that error is larger than the normal bias, the shadow test fails on
 * lit ground and the surface breaks up into stripes and speckle — shadow
 * acne.
 *
 * This is why lowering the sun broke the ground: at 24° the requirement
 * was ~0.2 m, at 14° it is ~0.36 m, and the bias was still 0.045.
 */
function shadowNormalBias(extent, mapSize) {
  const texel = (extent * 2) / mapSize
  const tanElevation = Math.max(
    0.12,
    SUN_DIRECTION.y / Math.hypot(SUN_DIRECTION.x, SUN_DIRECTION.z)
  )
  // 1.35 leaves a small safety margin over the worst-case texel error
  return Math.min(0.6, (texel / tanElevation) * 1.35)
}

/**
 * The lunar light rig.
 *
 * The Moon has no atmosphere: sunlight is intensely directional, the
 * shadows are absolute black, and there is no sky to fill them. The
 * realism comes from resisting the urge to add fill light.
 *
 *   • Sun — low on the horizon so the surface gets long, raking shadows
 *     and every pebble casts. High sun flattens the ground into paint.
 *   • Earthshine — a very weak cool fill so shadowed sides are readable
 *     without destroying the contrast. Real earthshine is about 1/10000
 *     of sunlight; this is art-directed but deliberately faint.
 *   • The sun's shadow camera follows the explorer, so shadow resolution
 *     stays tight anywhere in the 400-unit world.
 */
export default function LightRig({ isMobile }) {
  const sun = useRef()
  const target = useRef()
  const follower = useRef()
  const { scene, camera } = useThree()

  useEffect(() => {
    if (sun.current && target.current) {
      sun.current.target = target.current
      scene.add(target.current)
    }
    return () => {
      if (target.current) scene.remove(target.current)
    }
  }, [scene])

  useFrame(() => {
    // Keep the shadow frustum centred on the explorer
    if (target.current) {
      target.current.position.set(camera.position.x, 0, camera.position.z)
      target.current.updateMatrixWorld()
    }
    if (sun.current) {
      // Anchored to the explorer, not the world. A fixed Y would put the
      // sun below the horizon once she climbs the south-pole massif, which
      // lit the ground from underneath and inverted every shadow.
      sun.current.position.set(
        camera.position.x + SUN_DIRECTION.x * 120,
        camera.position.y + SUN_DIRECTION.y * 120,
        camera.position.z + SUN_DIRECTION.z * 120
      )
    }
    if (follower.current) {
      follower.current.position.copy(camera.position)
    }
  })

  const size = isMobile ? 1024 : 2048
  // A tighter shadow frustum is the cheapest accuracy win available: halving
  // the extent quarters the texel area, so shadows are sharper AND the
  // required bias drops.
  const extent = isMobile ? 58 : 72
  const normalBias = shadowNormalBias(extent, size)

  return (
    <>
      {/* The sun: hard, low, and the only real light source.
          Intensity raised and the angle dropped — a high sun flattens a
          surface into paint, because every slope receives nearly the same
          light. At a lower angle the same terrain reads as land. */}
      <directionalLight
        ref={sun}
        intensity={5.0}
        color="#fffaf2"
        castShadow
        shadow-mapSize-width={size}
        shadow-mapSize-height={size}
        shadow-camera-left={-extent}
        shadow-camera-right={extent}
        shadow-camera-top={extent}
        shadow-camera-bottom={-extent}
        shadow-camera-near={1}
        shadow-camera-far={420}
        shadow-bias={-0.0002}
        shadow-normalBias={normalBias}
      />
      <object3D ref={target} />

      {/* Earthshine — a trace of cool bounce, nothing more. Slightly up
          from before: pure black shadows swallow the terrain silhouette,
          and a whisper of blue is physically real when Earth is high. */}
      <directionalLight
        ref={follower}
        position={[-1, 0.35, -0.6]}
        intensity={0.17}
        color="#7f9dd6"
      />
    </>
  )
}
