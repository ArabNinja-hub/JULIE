import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { SUN_DIRECTION } from '../../lib/terrain'

/**
 * Sun shafts.
 *
 * A hard truth first: the Moon has no atmosphere, so there is no air to
 * scatter light and no visible beam. A glowing cone radiating from the sun
 * would be a lie, and the kind of lie that makes a space scene look like a
 * screensaver.
 *
 * What the Moon *does* have is dust — levitated electrostatic dust, and the
 * fine ejecta thrown up by every footfall and every landing. Astronauts
 * photographed it as faint horizon glow. Shafting through suspended
 * particulate is physically defensible, so that is what these are: light
 * travelling through dust, not through air.
 *
 * Implementation notes, because volumetric light is where frame rates go
 * to die:
 *   • Four flattened, tapered quads aligned to the sun axis, not a volume.
 *   • Additive blending with very low opacity — they should be found, not
 *     noticed, and must never wash out the sky they cross.
 *   • depthWrite false so they never occlude the terrain behind them.
 *   • No shadow lookups and no per-pixel work: the whole effect is a
 *     texture-free gradient shader.
 */

const SHAFT_COUNT = 4

export default function SunShafts({ strength = 1 }) {
  const group = useRef()
  const { camera } = useThree()

  /* The shafts lie along the sun direction. Building them once as
     geometry and rotating the group means the shader never changes. */
  const quaternion = useMemo(() => {
    const sun = new THREE.Vector3(SUN_DIRECTION.x, SUN_DIRECTION.y, SUN_DIRECTION.z).normalize()
    // The shaft geometry is built along +Y, so rotate +Y onto the sun ray
    return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), sun)
  }, [])

  const shafts = useMemo(
    () =>
      Array.from({ length: SHAFT_COUNT }, (_, i) => {
        // Fan them around the sun axis so the effect has breadth without
        // looking like a single solid beam
        const seed = i * 1.7
        return {
          angle: (i / SHAFT_COUNT) * Math.PI * 2 + seed * 0.3,
          offset: 0.55 + (i % 2) * 0.5,
          length: 300 + (i % 3) * 70,
          width: 24 + (i % 3) * 12,
          opacity: 0.055 + (i % 2) * 0.022,
        }
      }),
    []
  )

  useFrame(() => {
    if (group.current) {
      // Anchored to the camera: the shafts are "out there", infinitely far,
      // so they must not parallax as she moves.
      group.current.position.copy(camera.position)
    }
  })

  return (
    <group ref={group} quaternion={quaternion}>
      {shafts.map((s, i) => (
        <mesh
          key={i}
          position={[
            Math.cos(s.angle) * s.offset * 30,
            s.length * 0.42,
            Math.sin(s.angle) * s.offset * 30,
          ]}
          rotation={[0, s.angle, 0]}
          renderOrder={-1}
        >
          <planeGeometry args={[s.width, s.length]} />
          <shaderMaterial
            transparent
            depthWrite={false}
            depthTest={false}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
            fog={false}
            uniforms={{
              uOpacity: { value: s.opacity * strength },
            }}
            vertexShader={`
              varying vec2 vUv;
              void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
              }
            `}
            fragmentShader={`
              varying vec2 vUv;
              uniform float uOpacity;
              void main() {
                // Fade along the length: bright at the sun end, gone at the
                // far end, so the shaft has no visible cut-off.
                float along = smoothstep(0.0, 1.0, vUv.y);
                float tip = pow(vUv.y, 2.2);
                // Fade across the width: a soft core, not a hard-edged bar.
                float across = 1.0 - abs(vUv.x - 0.5) * 2.0;
                across = pow(max(across, 0.0), 2.4);
                float a = tip * across * uOpacity;
                gl_FragColor = vec4(vec3(1.0, 0.97, 0.90) * a, a);
              }
            `}
          />
        </mesh>
      ))}
    </group>
  )
}
