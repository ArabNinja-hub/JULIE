import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import Terrain, { Rocks } from './Terrain'
import LightRig from './LightRig'
import FirstPersonControls from './FirstPersonControls'
import Landmarks from './Landmarks'
import LunarSky from './LunarSky'

function Loading() {
  return null
}

/**
 * The explorable lunar world.
 *
 * A single low sun rakes across the terrain (long, dramatic shadows), a
 * cool blue bounce light lifts the shadow side, and a faint lavender rim
 * keeps the palette consistent with the rest of the site.
 */
function Scene({
  api,
  onStep,
  destinationId,
  foundLandmarks,
  onSelectLandmark,
  onNearby,
  isMobile,
}) {
  return (
    <>
      <color attach="background" args={['#04060f']} />
      {/* Distance haze: gives the horizon depth without swallowing Earth */}
      <fog attach="fog" args={['#070c1a', 120, 520]} />

      {/* Low raking sun — the whole mood comes from this */}
      <LightRig isMobile={isMobile} />

      {/* Cool skylight — Earthshine bouncing off the ground */}
      <hemisphereLight args={['#8fb0ff', '#161d33', 1.1]} />

      {/* Lavender rim from the opposite side */}
      <directionalLight position={[-140, 40, -120]} intensity={0.75} color="#a78bfa" />

      <Suspense fallback={<Loading />}>
        <Terrain segments={isMobile ? 128 : 200} />
        <Rocks count={isMobile ? 150 : 300} />
        <Landmarks
          destinationId={destinationId}
          foundIds={foundLandmarks}
          onSelect={onSelectLandmark}
          onNearby={onNearby}
        />
        <LunarSky isMobile={isMobile} />
      </Suspense>

      <FirstPersonControls api={api} onStep={onStep} isMobile={isMobile} />
    </>
  )
}

export default function ExploreScene(props) {
  return (
    <Canvas
      shadows
      frameloop={props.paused ? 'never' : 'always'}
      dpr={[1, props.isMobile ? 1.25 : 1.75]}
      camera={{
        position: [0, 3, 0],
        fov: props.isMobile ? 78 : 68,
        near: 0.1,
        far: 700,
      }}
      gl={{
        antialias: !props.isMobile,
        powerPreference: 'high-performance',
        alpha: false,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.05,
      }}
      onCreated={({ gl }) => {
        gl.shadowMap.type = THREE.PCFSoftShadowMap
      }}
    >
      <Scene {...props} />
    </Canvas>
  )
}
