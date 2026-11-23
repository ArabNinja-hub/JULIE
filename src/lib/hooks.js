import { useEffect, useState, useSyncExternalStore } from 'react'
import {
  subscribeSong,
  getSongState,
  getServerSongState,
} from './song'

/**
 * Subscribes to the global song state. Because the audio element lives
 * outside React, this hook can be mounted anywhere — and remounted on
 * navigation — without ever interrupting playback.
 */
export function useSong() {
  return useSyncExternalStore(subscribeSong, getSongState, getServerSongState)
}

/** True when the viewport is narrow enough to count as a phone. */
export function useIsMobile(breakpoint = 768) {
  const [mobile, setMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < breakpoint
  )
  useEffect(() => {
    const onResize = () => setMobile(window.innerWidth < breakpoint)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [breakpoint])
  return mobile
}

/** True when WebGL can actually be initialised. */
export function useWebGL() {
  const [ok, setOk] = useState(true)
  useEffect(() => {
    try {
      const canvas = document.createElement('canvas')
      const gl =
        canvas.getContext('webgl2') ||
        canvas.getContext('webgl') ||
        canvas.getContext('experimental-webgl')
      setOk(Boolean(gl))
    } catch {
      setOk(false)
    }
  }, [])
  return ok
}

/** Fires once when the element scrolls into view. */
export function useInView(ref, options = {}) {
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || seen) return
    if (typeof IntersectionObserver === 'undefined') {
      setSeen(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setSeen(true)
          io.disconnect()
        }
      },
      { threshold: 0.15, ...options }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [ref, seen, options])
  return seen
}

export function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}
