import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Stars } from '@react-three/drei'
import { makeEarthTexture, SUN_DIRECTION } from '../../lib/terrain'

/**
 * Deep-space backdrop: a dense starfield that follows the camera (so it
 * reads as infinitely distant), plus Earth hanging in the lunar sky.
 */
export default function LunarSky({ isMobile }) {
  const group = useRef()
  const earthGroup = useRef()
  const sunGroup = useRef()
  const { camera } = useThree()

  const earthMap = useMemo(() => {
    const tex = new THREE.CanvasTexture(makeEarthTexture())
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 4
    return tex
  }, [])

  useEffect(() => () => earthMap.dispose(), [earthMap])

  useFrame((state, delta) => {
    // The star dome travels with the camera — parallax-free infinity
    if (group.current) {
      group.current.position.copy(camera.position)
    }
    if (sunGroup.current) {
      // The Sun sits along exactly the axis the key light shines down, so
      // every shadow on the ground visibly points away from it. Airless
      // sky: a hard disc, no halo to speak of.
      sunGroup.current.position.set(
        camera.position.x + SUN_DIRECTION.x * 380,
        camera.position.y + SUN_DIRECTION.y * 380,
        camera.position.z + SUN_DIRECTION.z * 380
      )
    }
    if (earthGroup.current) {
      earthGroup.current.rotation.y += delta * 0.06
      // Earth stays fixed in the sky relative to the world, not the camera
      const t = state.clock.elapsedTime
      earthGroup.current.position.y =
        camera.position.y + 90 + Math.sin(t * 0.1) * 1.5
      earthGroup.current.position.x = camera.position.x - 40
      earthGroup.current.position.z = camera.position.z - 250
    }
  })

  return (
    <group>
      <group ref={group}>
        <Stars
          radius={420}
          depth={180}
          count={isMobile ? 3000 : 7000}
          factor={7}
          saturation={0}
          fade
          speed={0.25}
        />
      </group>

      {/* The Sun. Reflected light is the only light on the Moon, so the
          disc itself is blindingly bright while the sky stays black. */}
      <group ref={sunGroup}>
        <mesh>
          <sphereGeometry args={[4.2, 24, 16]} />
          <meshBasicMaterial color="#ffffff" toneMapped={false} fog={false} />
        </mesh>
        {/* Barely-there scatter — enough to seat the disc in the sky
            without pretending there is an atmosphere. */}
        <mesh scale={2.6}>
          <sphereGeometry args={[4.2, 20, 12]} />
          <meshBasicMaterial
            color="#cfd9ff"
            transparent
            opacity={0.05}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.BackSide}
            fog={false}
          />
        </mesh>
      </group>

      {/* Earth — a small blue marble above the horizon */}
      <group ref={earthGroup} position={[-40, 90, -250]}>
        <mesh>
          <sphereGeometry args={[11, isMobile ? 24 : 40, isMobile ? 16 : 28]} />
          <meshStandardMaterial
            map={earthMap}
            roughness={0.85}
            metalness={0}
            emissive="#16325c"
            emissiveIntensity={0.4}
            fog={false}
          />
        </mesh>
        {/* Atmospheric glow */}
        <mesh scale={1.09}>
          <sphereGeometry args={[11, 24, 16]} />
          <meshBasicMaterial
            color="#6a9cff"
            transparent
            opacity={0.14}
            side={THREE.BackSide}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            fog={false}
          />
        </mesh>
        <pointLight color="#8fb6ff" intensity={140} distance={160} decay={2} />
      </group>
    </group>
  )
}
