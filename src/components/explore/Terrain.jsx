import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import {
  WORLD,
  PADS,
  terrainHeight,
  terrainColor,
  makeRegolithNormalTexture,
  makeRegolithRoughnessTexture,
} from '../../lib/terrain'
import { useDepthMaterial } from './DepthFog'

/**
 * The lunar surface.
 *
 * One continuous heightfield covering all four regions, coloured per
 * vertex with true (dark) regolith albedo. On top of that sit two tiling
 * detail maps — a fine normal map and a roughness map — which supply the
 * centimetre-scale texture the vertex mesh can never hold. The result
 * catches the low sun as dry, powdery ground rather than painted glass.
 *
 * Geometry and textures are built once and disposed on unmount.
 */
export default function Terrain({ segments = 200 }) {
  const geometry = useMemo(() => {
    const size = WORLD.size
    const g = new THREE.PlaneGeometry(size, size, segments, segments)
    g.rotateX(-Math.PI / 2)

    const pos = g.attributes.position
    const count = pos.count
    const n = segments + 1
    const step = size / segments

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

    // Per-vertex colour from albedo and local slope
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
        (Math.abs(hR - hL) + Math.abs(hD - hU)) / (step * 1.7)
      )
      const [r, gg, b] = terrainColor(xs[i], zs[i], slope)
      colors[i * 3] = r
      colors[i * 3 + 1] = gg
      colors[i * 3 + 2] = b
    }

    g.setAttribute('color', new THREE.BufferAttribute(colors, 3))

    /* Normals from the analytic surface, not from the triangles.
     *
     * computeVertexNormals() averages face normals, which is correct but
     * leaves the mesh's own facets faintly visible on slopes seen at a
     * grazing angle — the quad edges read as a staircase. Sampling the
     * true gradient at each vertex gives a continuous normal field, so the
     * shading is smooth no matter how few polygons the surface has. It is
     * also cheaper than averaging.
     */
    const normals = new Float32Array(count * 3)
    const e = step * 0.5
    for (let i = 0; i < count; i++) {
      const x = xs[i]
      const z = zs[i]
      const gx =
        (terrainHeight(x + e, z) - terrainHeight(x - e, z)) / (2 * e)
      const gz =
        (terrainHeight(x, z + e) - terrainHeight(x, z - e)) / (2 * e)
      const inv = 1 / Math.hypot(gx, 1, gz)
      normals[i * 3] = -gx * inv
      normals[i * 3 + 1] = inv
      normals[i * 3 + 2] = -gz * inv
    }
    g.setAttribute('normal', new THREE.BufferAttribute(normals, 3))

    g.computeBoundingSphere()
    return g
  }, [segments])

  const normalMap = useMemo(
    () => makeRegolithNormalTexture(256),
    []
  )
  const roughnessMap = useMemo(
    () => makeRegolithRoughnessTexture(256),
    []
  )

  const depth = useDepthMaterial()

  useEffect(
    () => () => {
      geometry.dispose()
      normalMap.dispose()
      roughnessMap.dispose()
    },
    [geometry, normalMap, roughnessMap]
  )

  return (
    /* The terrain must cast as well as receive: the long shadows in the
       bottom of craters are cast by the crater's own far wall. Self-shadow
       acne on this surface is handled by the derived normal bias in
       LightRig, which is what makes the reduced sun angle safe. */
    <mesh geometry={geometry} receiveShadow castShadow>
      <meshStandardMaterial
        vertexColors
        normalMap={normalMap}
        // The detail map carries the centimetre texture the mesh cannot.
        // Stronger than before: at 0.45 the ground read as smooth plastic
        // up close, which is the opposite of regolith.
        normalScale={new THREE.Vector2(0.85, 0.85)}
        roughnessMap={roughnessMap}
        roughness={1}
        metalness={0}
        dithering
        onBeforeCompile={depth.onBeforeCompile}
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

/**
 * Loose rock, from pebbles to house-sized boulders.
 *
 * Real lunar terrain is littered with ejecta; bare ground reads as fake.
 * These are instanced from three irregular geometries so the count stays
 * cheap while the variety does not look repeated. Each rock is sunk
 * slightly into the ground so none appear to float.
 */
export function Rocks({ count = 300, seed = 20240720, focusIndex = 0 }) {
  const rocks = useMemo(() => {
    const rand = rng(seed)
    const dummy = new THREE.Object3D()
    const list = []

    /* Scatter is concentrated where she actually walks.
     *
     * Uniform scatter across a 400-unit world puts almost nothing within
     * sight of the camera: the foreground reads as bare ground, which is
     * the strongest "empty stage" cue there is. Two thirds of the rocks are
     * therefore drawn from a disc around the destination she is standing
     * in, weighted toward the middle; the rest still fill the world so the
     * horizon is not suspiciously tidy.
     */
    const focus = PADS[focusIndex] || PADS[0]

    let guard = 0
    while (list.length < count && guard < count * 60) {
      guard++
      let x
      let z
      if (guard % 3 !== 0) {
        // Near field: dense in the middle, thinning outward
        const a = rand() * Math.PI * 2
        const r = Math.pow(rand(), 0.62) * 95
        x = focus.x + Math.cos(a) * r
        z = focus.z + Math.sin(a) * r
      } else {
        // Far field: the rest of the world
        x = (rand() - 0.5) * WORLD.size * 0.86
        z = (rand() - 0.5) * WORLD.size * 0.86
      }

      const h = terrainHeight(x, z)
      const dx = terrainHeight(x + 2, z) - h
      const dz = terrainHeight(x, z + 2) - h
      const slope = Math.hypot(dx, dz) / 2

      // Steep ground sheds rock; flats and crater floors collect it
      if (slope > 0.9 && rand() > 0.2) continue

      // Heavy skew toward small stones, with rare large boulders
      const t = rand()
      const size = 0.28 + Math.pow(t, 3.2) * 5.2

      // Ejecta near the big craters is denser and larger
      const nearCopernicus =
        Math.hypot(x - 100, z + 100) < 120 ? 1 : 0
      const nearTycho = Math.hypot(x + 100, z - 100) < 110 ? 1 : 0
      if ((nearCopernicus || nearTycho) && rand() > 0.55) continue

      dummy.position.set(x, h - size * 0.22, z)
      dummy.rotation.set(
        rand() * Math.PI,
        rand() * Math.PI * 2,
        rand() * Math.PI
      )
      // Flattened, angular — not spheres
      dummy.scale.set(
        size * (0.7 + rand() * 0.7),
        size * (0.4 + rand() * 0.45),
        size * (0.7 + rand() * 0.7)
      )
      dummy.updateMatrix()
      list.push({
        matrix: dummy.matrix.clone(),
        variant: Math.floor(rand() * 3),
        shade: 0.055 + rand() * 0.06,
      })
    }
    return list
  }, [count, seed, focusIndex])

  // Three irregular base shapes, split into instanced meshes
  const variants = useMemo(() => {
    const geoms = [
      new THREE.DodecahedronGeometry(1, 0),
      new THREE.IcosahedronGeometry(1, 0),
      new THREE.DodecahedronGeometry(1, 1),
    ]
    // Rough up the vertices so nothing reads as a manufactured solid
    geoms.forEach((g, gi) => {
      const p = g.attributes.position
      const rand = rng(900 + gi)
      for (let i = 0; i < p.count; i++) {
        const f = 0.74 + rand() * 0.5
        p.setXYZ(i, p.getX(i) * f, p.getY(i) * f, p.getZ(i) * f)
      }
      g.computeVertexNormals()
    })
    return geoms
  }, [])

  useEffect(() => () => variants.forEach((g) => g.dispose()), [variants])

  const byVariant = useMemo(() => {
    const groups = [[], [], []]
    rocks.forEach((r) => groups[r.variant].push(r))
    return groups
  }, [rocks])

  return (
    <group>
      {variants.map((geo, vi) => {
        const items = byVariant[vi]
        if (!items.length) return null
        return (
          <instancedMesh
            key={vi}
            args={[geo, undefined, items.length]}
            /* Shadows come from the terrain and the large boulders. The
               smallest rocks fall below the shadow map's own resolution at
               this sun angle, so casting them only produces detached blobs. */
            castShadow
            receiveShadow
            frustumCulled={false}
            ref={(mesh) => {
              if (!mesh) return
              items.forEach((r, i) => mesh.setMatrixAt(i, r.matrix))
              mesh.instanceMatrix.needsUpdate = true
            }}
          >
            <meshStandardMaterial
              color="#6e7280"
              roughness={0.94}
              metalness={0}
              flatShading
              vertexColors={false}
            />
          </instancedMesh>
        )
      })}
    </group>
  )
}

/**
 * A sparse drift of fine stones right around the explorer, so the ground
 * close to the camera is never empty. Cheap: a few hundred tiny instances
 * that follow the camera in world space.
 */
export function Pebbles({ count = 220 }) {
  const { geometry, matrices } = useMemo(() => {
    const rand = rng(5150)
    const dummy = new THREE.Object3D()
    const list = []
    const R = 46

    for (let i = 0; i < count; i++) {
      const a = rand() * Math.PI * 2
      const d = Math.sqrt(rand()) * R
      const x = Math.cos(a) * d
      const z = Math.sin(a) * d
      const size = 0.035 + Math.pow(rand(), 2) * 0.16
      dummy.position.set(x, terrainHeight(x, z) + size * 0.2, z)
      dummy.rotation.set(rand() * 3, rand() * 3, rand() * 3)
      dummy.scale.setScalar(size)
      dummy.updateMatrix()
      list.push(dummy.matrix.clone())
    }
    return { geometry: new THREE.TetrahedronGeometry(1, 0), matrices: list }
  }, [count])

  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <instancedMesh
      args={[geometry, undefined, matrices.length]}
      receiveShadow
      frustumCulled={false}
      ref={(mesh) => {
        if (!mesh) return
        matrices.forEach((m, i) => mesh.setMatrixAt(i, m))
        mesh.instanceMatrix.needsUpdate = true
      }}
    >
      <meshStandardMaterial
        color="#575b66"
        roughness={0.96}
        metalness={0}
        // Pebbles are 3-20cm; the shadow bias needed for the low sun is
        // ~0.37m, larger than they are. Letting them cast would place their
        // shadows a whole pebble away from themselves. Near-field stones get
        // their depth from shading, not from the shadow map.
      />
    </instancedMesh>
  )
}
