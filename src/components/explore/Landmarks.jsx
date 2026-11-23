import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import {
  terrainHeight,
  makeGlowTexture,
  makeMarkerTexture,
} from '../../lib/terrain'
import { LANDMARKS } from '../../lib/destinations'

/**
 * Interactive discovery markers planted on the lunar surface.
 *
 * Each beacon is a billboard that scales with distance, so it holds a
 * constant size on screen however far away it is — findable from across
 * a crater, never looming when she walks up to it. A soft ring of light
 * on the regolith marks the exact spot. Clicking anywhere near a beacon
 * logs the discovery.
 */
export default function Landmarks({ destinationId, foundIds, onSelect, onNearby }) {
  const glow = useMemo(() => new THREE.CanvasTexture(makeGlowTexture()), [])
  const glyph = useMemo(() => {
    const tex = new THREE.CanvasTexture(makeMarkerTexture())
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [])

  useEffect(
    () => () => {
      glow.dispose()
      glyph.dispose()
      document.body.style.removeProperty('cursor')
    },
    [glow, glyph]
  )

  const visible = useMemo(
    () => LANDMARKS.filter((l) => l.destination === destinationId),
    [destinationId]
  )

  return (
    <group>
      {visible.map((marker) => (
        <Marker
          key={marker.id}
          marker={marker}
          glow={glow}
          glyph={glyph}
          found={foundIds.includes(marker.id)}
          onSelect={onSelect}
          onNearby={onNearby}
        />
      ))}
    </group>
  )
}

const SILVER = new THREE.Color('#b9c4ff')
const LAVENDER = new THREE.Color('#c4b5fd')
const WHITE = new THREE.Color('#ffffff')

function Marker({ marker, glow, glyph, found, onSelect, onNearby }) {
  const beacon = useRef()
  const halo = useRef()
  const spin = useRef()
  const { camera } = useThree()

  const { x, z } = useMemo(
    () => ({ x: marker.position[0], z: marker.position[1] }),
    [marker.position]
  )
  const y = useMemo(() => terrainHeight(x, z), [x, z])
  const here = useMemo(() => new THREE.Vector3(x, y, z), [x, y, z])
  const reported = useRef(null)

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    const dist = camera.position.distanceTo(here)

    if (beacon.current) {
      beacon.current.position.y = y + 2.1 + Math.sin(t * 1.3 + x) * 0.18
      // Billboard: always square to the camera
      beacon.current.quaternion.copy(camera.quaternion)
      // Constant apparent size ⇒ legible from 200 units, tiny at 3
      const s = THREE.MathUtils.clamp(dist * 0.024, 0.35, 7)
      beacon.current.scale.setScalar(s)
      beacon.current.visible = dist > 1.6 && dist < 320
    }

    if (halo.current) {
      halo.current.rotation.z += delta * 0.22
      const pulse = 0.28 + Math.sin(t * 1.8 + z) * 0.12
      halo.current.material.opacity = pulse
      // Fade the ground ring out when she is standing on it
      halo.current.material.opacity *= THREE.MathUtils.clamp((dist - 1) / 5, 0, 1)
    }

    if (spin.current) spin.current.rotation.y += delta * 0.9

    /* Report proximity to the HUD, but only on meaningful change */
    const bucket = dist < 9 ? 'near' : dist < 26 ? 'close' : null
    if (bucket !== reported.current) {
      reported.current = bucket
      onNearby?.(bucket ? marker : null, bucket)
    }
  })

  return (
    <group>
      {/* Ring of light on the regolith */}
      <mesh
        ref={halo}
        position={[x, y + 0.1, z]}
        rotation={[-Math.PI / 2, 0, 0]}
        raycast={() => null}
      >
        <ringGeometry args={[2.1, 3.3, 44]} />
        <meshBasicMaterial
          color={found ? LAVENDER : SILVER}
          transparent
          opacity={0.3}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Fixed-size hit target — generous for thumbs, invisible */}
      <mesh
        position={[x, y + 2, z]}
        onPointerOver={(e) => {
          e.stopPropagation()
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'auto'
        }}
        onClick={(e) => {
          e.stopPropagation()
          document.body.style.cursor = 'auto'
          onSelect(marker.id)
        }}
      >
        <sphereGeometry args={[2.4, 10, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <group ref={beacon} position={[x, y + 2.1, z]}>
        <sprite scale={[4.6, 4.6, 1]} raycast={() => null}>
          <spriteMaterial
            map={glow}
            color={found ? LAVENDER : SILVER}
            transparent
            opacity={0.72}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </sprite>

        <sprite scale={[2.4, 2.4, 1]} raycast={() => null}>
          <spriteMaterial
            map={glyph}
            transparent
            opacity={0.95}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </sprite>

        <mesh ref={spin} raycast={() => null} scale={0.16}>
          <octahedronGeometry args={[1, 0]} />
          <meshBasicMaterial color={found ? LAVENDER : WHITE} />
        </mesh>
      </group>
    </group>
  )
}
