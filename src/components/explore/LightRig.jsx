import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { SUN_DIRECTION } from '../../lib/terrain'

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
  const extent = isMobile ? 70 : 95

  return (
    <>
      {/* The sun: hard, low, and the only real light source */}
      <directionalLight
        ref={sun}
        intensity={4.6}
        color="#fffdf8"
        castShadow
        shadow-mapSize-width={size}
        shadow-mapSize-height={size}
        shadow-camera-left={-extent}
        shadow-camera-right={extent}
        shadow-camera-top={extent}
        shadow-camera-bottom={-extent}
        shadow-camera-near={1}
        shadow-camera-far={400}
        shadow-bias={-0.0004}
        shadow-normalBias={0.045}
      />
      <object3D ref={target} />

      {/* Earthshine — a trace of cool bounce, nothing more */}
      <directionalLight
        ref={follower}
        position={[-1, 0.35, -0.6]}
        intensity={0.1}
        color="#7f9dd6"
      />
    </>
  )
}
