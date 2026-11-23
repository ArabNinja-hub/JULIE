import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import {
  WORLD,
  terrainHeight,
  terrainColor,
  makeGroundTexture,
} from '../../lib/terrain'

/**
 * The lunar surface.
 *
 * One continuous 400 × 400 heightfield holding all four regions, coloured
 * per-vertex (dark mare, bright Tycho rays, shadowed polar patches).
 * Geometry is generated once and disposed on unmount — no leaks.
 */
export default function Terrain({ segments = 176 }) {
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(
      WORLD.size,
      WORLD.size,
      segments,
      segments
    )
    g.rotateX(-Math.PI / 2)

    const pos = g.attributes.position
    const count = pos.count
    const n = segments + 1
    const step = WORLD.size / segments

    const heights = new Float32Array(count)
    const xs = new Float32Array(count)
    const zs = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      const x = pos.getX(i)
      const z = pos.getZ(i)
      xs[i] = x
      zs[i] = z
      const h = terrainHeight(x, z)
      heights[i] = h
      pos.setY(i, h)
    }
    pos.needsUpdate = true

    // Per-vertex colour, brightness driven by local slope
    const colors = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const ix = i % n
      const iy = (i / n) | 0
      const hL = heights[iy * n + Math.max(0, ix - 1)]
      const hR = heights[iy * n + Math.min(n - 1, ix + 1)]
      const hU = heights[Math.max(0, iy - 1) * n + ix]
      const hD = heights[Math.min(n - 1, iy + 1) * n + ix]
      const slope = Math.min(
        1,
        (Math.abs(hR - hL) + Math.abs(hD - hU)) / (step * 1.6)
      )
      const [r, gg, b] = terrainColor(xs[i], zs[i], slope)
      colors[i * 3] = r
      colors[i * 3 + 1] = gg
      colors[i * 3 + 2] = b
    }

    g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    g.computeVertexNormals()
    g.computeBoundingSphere()
    return g
  }, [segments])

  const groundTexture = useMemo(() => {
    const tex = new THREE.CanvasTexture(makeGroundTexture())
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(90, 90)
    tex.anisotropy = 4
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [])

  useEffect(
    () => () => {
      geometry.dispose()
      groundTexture.dispose()
    },
    [geometry, groundTexture]
  )

  return (
    <mesh geometry={geometry} receiveShadow castShadow>
      <meshStandardMaterial
        vertexColors
        map={groundTexture}
        roughness={0.97}
        metalness={0.02}
        color="#dfe4f2"
        dithering
      />
    </mesh>
  )
}

/* ---------------- Scattered rocks & boulders ---------------- */

function rng(seed) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

export function Rocks({ count = 260 }) {
  const { geometry, matrices } = useMemo(() => {
    const rand = rng(20240720)
    const dummy = new THREE.Object3D()
    const list = []

    let guard = 0
    while (list.length < count && guard < count * 40) {
      guard++
      const x = (rand() - 0.5) * WORLD.size * 0.88
      const z = (rand() - 0.5) * WORLD.size * 0.88

      // Slope check — rocks gather on flats and crater rims, not cliffs
      const h = terrainHeight(x, z)
      const dx = terrainHeight(x + 2, z) - h
      const dz = terrainHeight(x, z + 2) - h
      const slope = Math.hypot(dx, dz) / 2
      if (slope > 0.85 && rand() > 0.25) continue

      const size = 0.35 + rand() * rand() * 3.4
      dummy.position.set(x, h + size * 0.28, z)
      dummy.rotation.set(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI)
      dummy.scale.set(size, size * (0.55 + rand() * 0.5), size * (0.8 + rand() * 0.5))
      dummy.updateMatrix()
      list.push(dummy.matrix.clone())
    }

    const geometry = new THREE.DodecahedronGeometry(1, 0)
    return { geometry, matrices: list }
  }, [count])

  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <instancedMesh
      args={[geometry, undefined, matrices.length]}
      castShadow
      receiveShadow
      frustumCulled={false}
      ref={(mesh) => {
        if (!mesh) return
        matrices.forEach((m, i) => mesh.setMatrixAt(i, m))
        mesh.instanceMatrix.needsUpdate = true
      }}
    >
      <meshStandardMaterial
        color="#9aa1b6"
        roughness={0.92}
        metalness={0.06}
        flatShading
      />
    </instancedMesh>
  )
}
