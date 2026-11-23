import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import Terrain, { Rocks, Pebbles } from './Terrain'
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
const DESTINATION_ORDER = ['tranquility', 'copernicus', 'tycho', 'southpole']

function Scene({
  api,
  onStep,
  destinationId,
  foundLandmarks,
  onSelectLandmark,
  onNearby,
  isMobile,
}) {
  // Rocks cluster around whichever destination she is standing in
  const padIndex = Math.max(0, DESTINATION_ORDER.indexOf(destinationId))

  return (
    <>
      <color attach="background" args={['#02030a']} />

      {/*
        There is no atmosphere on the Moon, so there is no aerial haze.
        Distant terrain stays almost as crisp as near terrain — only a
        whisper of fog keeps the far edge of the world from looking like
        a hard cut, and it is pushed far back.
      */}
      <fog attach="fog" args={['#050814', 260, 620]} />

      {/* Hard low sun + a trace of earthshine */}
      <LightRig isMobile={isMobile} />

      {/* A very faint ambient floor so nothing is pure #000 — real
          shadowed regolith still catches starlight and earthshine. */}
      <ambientLight intensity={0.045} color="#5a6b96" />

      <Suspense fallback={<Loading />}>
        <Terrain segments={isMobile ? 224 : 384} />
        <Rocks count={isMobile ? 420 : 900} focusIndex={padIndex} />
        <Pebbles count={isMobile ? 260 : 520} />
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
