import { useMemo } from 'react'
import * as THREE from 'three'

/**
 * Distance depth for the lunar surface.
 *
 * An airless Moon has no atmospheric haze — that part of the old comment
 * was right. But a scene with zero aerial perspective still needs depth
 * *separation*, and on the Moon that comes from a real physical effect:
 * the sun's shadow terminator and long grazing-angle shadowing mean that
 * ground far from you is systematically less lit than ground underfoot.
 *
 * Rather than fake aerial perspective, this applies a gentle distance
 * darkening to the terrain and rocks — far ground sinks toward the sky
 * colour instead of competing with near ground at identical contrast. It
 * is the difference between a flat plane and a landscape with distance.
 *
 * Implemented as a shader chunk injection on the standard material, so it
 * inherits lighting, normal maps and shadows untouched.
 */
export function useDepthMaterial(distanceScale = 1) {
  const uniforms = useMemo(
    () => ({
      uDepthNear: { value: 14 * distanceScale },
      uDepthFar: { value: 300 * distanceScale },
      uDepthStrength: { value: 0.62 },
      uDepthColor: { value: new THREE.Color('#070b18') },
    }),
    [distanceScale]
  )

  const onBeforeCompile = useMemo(
    () => (shader) => {
      shader.uniforms.uDepthNear = uniforms.uDepthNear
      shader.uniforms.uDepthFar = uniforms.uDepthFar
      shader.uniforms.uDepthStrength = uniforms.uDepthStrength
      shader.uniforms.uDepthColor = uniforms.uDepthColor

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
           varying float vViewDepth;`
        )
        .replace(
          '#include <project_vertex>',
          `#include <project_vertex>
           // Distance from the eye along the view axis — the metric that
           // matters for depth, not world position.
           vViewDepth = -mvPosition.z;`
        )

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
           uniform float uDepthNear;
           uniform float uDepthFar;
           uniform float uDepthStrength;
           uniform vec3 uDepthColor;
           varying float vViewDepth;`
        )
        .replace(
          '#include <dithering_fragment>',
          `#include <dithering_fragment>
           // Smooth ease so there is no visible ring where the effect
           // starts; far ground loses contrast and cools toward the sky.
           // Statements need semicolons: without them the shader fails to
           // compile and the terrain renders as a black or blown-out
           // surface, which looks like broken geometry rather than a typo.
           float depthMix = smoothstep(uDepthNear, uDepthFar, vViewDepth);
           depthMix = depthMix * depthMix * uDepthStrength;
           gl_FragColor.rgb = mix(gl_FragColor.rgb, uDepthColor, depthMix);`
        )
    },
    [uniforms]
  )

  return { uniforms, onBeforeCompile }
}
