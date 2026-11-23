import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import Starfield from './components/Starfield'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import MusicPlayer from './components/MusicPlayer'
import RegionScroll from './components/RegionScroll'
import HiggsfieldLayer, {
  useHiggsfieldAsset,
} from './components/HiggsfieldLayer'
import {
  About,
  ExplorationIntro,
  Observations,
  Appreciation,
  CornerSection,
  Footer,
} from './components/Sections'
import { useIsMobile, useWebGL, prefersReducedMotion } from './lib/hooks'

// The exploration world is heavy — it only loads when she asks for it.
const LunarExperience = lazy(() => import('./components/explore/LunarExperience'))

export default function App() {
  const isMobile = useIsMobile()
  const webgl = useWebGL()
  const hasCinematic = useHiggsfieldAsset()

  const [exploring, setExploring] = useState(false)
  const [cinematicOpen, setCinematicOpen] = useState(false)
  const [pendingDestination, setPendingDestination] = useState(null)
  const reducedMotion = useRef(prefersReducedMotion())

  /* Warm the exploration bundle shortly after load, so "Explore the Moon"
     feels instant — without ever blocking the first paint. */
  useEffect(() => {
    if (!webgl) return
    const t = setTimeout(() => {
      import('./components/explore/LunarExperience')
    }, 2600)
    return () => clearTimeout(t)
  }, [webgl])

  const openExplore = useCallback(
    (destinationId = null) => {
      // Without WebGL there is nothing to walk on — never open a blank world
      if (!webgl) {
        document.getElementById('explore')?.scrollIntoView({ behavior: 'smooth' })
        return
      }
      setPendingDestination(destinationId)
      setExploring(true)
    },
    [webgl]
  )

  const closeExplore = useCallback(() => {
    setExploring(false)
    setPendingDestination(null)
  }, [])

  /**
   * "ENTER JULIET'S UNIVERSE" — the music has already been started by the
   * button itself (it must be, to satisfy browser gesture rules); this
   * only opens the journey on the Moon.
   */
  const enterUniverse = useCallback(() => {
    openExplore()
  }, [openExplore])

  return (
    <>
      <Starfield paused={exploring} />
      <div className="nebula" aria-hidden="true" />

      {/* First stop in the tab order: jump past the navigation. */}
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <Navbar onExplore={() => openExplore()} />
      <MusicPlayer />

      <main id="main">
        <Hero
          isMobile={isMobile}
          onEnter={enterUniverse}
          hasCinematic={hasCinematic}
          onPlayCinematic={() => setCinematicOpen(true)}
          exploring={exploring}
        />
        <ExplorationIntro
          onExplore={() => openExplore()}
          webgl={webgl}
          isMobile={isMobile}
        />
        <About />
        <Observations />
        <RegionScroll onExploreAt={openExplore} />
        <Appreciation />
        <CornerSection />
      </main>
      <Footer />

      {hasCinematic && (
        <HiggsfieldLayer
          open={cinematicOpen}
          onClose={() => setCinematicOpen(false)}
        />
      )}

      {exploring && webgl && (
        <Suspense fallback={null}>
          <LunarExperience
            onExit={closeExplore}
            isMobile={isMobile}
            reducedMotion={reducedMotion.current}
            initialDestination={pendingDestination}
          />
        </Suspense>
      )}
    </>
  )
}
