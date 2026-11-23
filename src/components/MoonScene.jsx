import { Suspense, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Stars } from '@react-three/drei'
import * as THREE from 'three'
import Moon from './Moon'

/**
 * The hero scene: the moon, cinematic lighting, a deep starfield.
 *
 * Drag to orbit (mouse or touch). The key light rakes in from the upper
 * right so the bump map reads as real crater relief; a lavender rim
 * light from behind separates the sphere from the dark; a cool fill
 * lifts the shadow side just enough to keep the craters visible.
 */
/**
 * A very slow rotation of the star dome.
 *
 * drei's `Stars` only animates its twinkle — the positions never move, so
 * the hero sky looked like a photograph. Turning the whole dome is what
 * makes it read as sky: 0.007 rad/s is about one revolution every fifteen
 * minutes, slow enough to be subliminal on a glance and unmistakable if you
 * watch for a moment. Tilted about 22 degrees so the motion is not a flat
 * barrel roll.
 */
function DriftingStars({ isMobile, speed = 0.007, reducedMotion }) {
  const group = useRef()
  useFrame((_, delta) => {
    if (reducedMotion || !group.current) return
    group.current.rotation.y += delta * speed
    group.current.rotation.z += delta * speed * 0.16
  })
  return (
    <group ref={group} rotation={[0.38, 0, 0]}>
      <Stars
        radius={80}
        depth={46}
        count={isMobile ? 1400 : 3200}
        factor={4.5}
        saturation={0}
        fade
        speed={reducedMotion ? 0 : 0.5}
      />
    </group>
  )
}

export default function MoonScene({
  isMobile = false,
  paused = false,
  reducedMotion = false,
}) {
  return (
    <Canvas
      dpr={[1, isMobile ? 1.5 : 2]}
      camera={{ position: [0, 0, 5.2], fov: 38 }}
      frameloop={paused ? 'never' : 'always'}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 0.96,
      }}
      style={{ touchAction: 'pan-y' }}
    >
      <ambientLight intensity={0.1} />

      {/* Key: silver sunlight, raking from the upper right. Placed off
          axis so a terminator falls across the disc instead of lighting
          the sphere flat. */}
      <directionalLight position={[4.6, 1.6, 3.2]} intensity={2.35} color="#f4f6ff" />

      {/* Lavender rim from behind-left — the atmospheric edge.
          Deliberately restrained: an accent, not a wash. */}
      <directionalLight position={[-5, 1.2, -3.4]} intensity={0.62} color="#b9a5ff" />

      {/* Cool blue fill, just enough to keep craters legible in shadow */}
      <directionalLight position={[2.4, -2.6, 2.2]} intensity={0.2} color="#7f95ff" />

      {/* A whisper of warm light where the shadow side turns away */}
      <pointLight position={[-2.6, -1.6, 1.4]} intensity={0.35} color="#c9b8ff" />

      <Suspense fallback={null}>
        <Moon isMobile={isMobile} reducedMotion={reducedMotion} />
        <DriftingStars isMobile={isMobile} reducedMotion={reducedMotion} />
      </Suspense>

      <OrbitControls
        enableZoom={false}
        enablePan={false}
        rotateSpeed={0.42}
        dampingFactor={0.07}
        enableDamping
        minPolarAngle={Math.PI * 0.28}
        maxPolarAngle={Math.PI * 0.72}
      />
    </Canvas>
  )
}
