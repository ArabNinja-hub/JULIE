/**
 * ============================================================
 *  JULIET'S SONG — the persistent music engine
 * ============================================================
 *
 *  One HTMLAudioElement is created lazily, on the first user gesture,
 *  and then never destroyed. It is deliberately kept *outside* React's
 *  tree (not rendered by a component), so navigating between sections,
 *  opening the lunar explorer, or toggling any UI can never unmount it
 *  and restart the track. The floating player is only a view onto this
 *  single element.
 *
 *  The file itself lives at the repository root, exactly where it was
 *  added, and is referenced through `import.meta.env.BASE_URL` so the
 *  same build works at a domain root *and* under a GitHub Pages
 *  repository subpath (e.g. /JULIE/).
 */

export const TRACK = {
  title: 'Holy Place',
  // Kept short and clean for the player; the file itself keeps its full name.
  artist: 'Abundant Worship',
  fileName: 'Holy Place – Abundant Worship Lyrics Video.mp3',
}

/** Resolves the track URL correctly under any deploy base path. */
export function trackUrl() {
  // BASE_URL is injected by Vite ("/JULIE/" on Pages, "/" when served at a
  // domain root). The optional chaining keeps this importable outside Vite
  // (tests, SSR) without blowing up.
  const base = import.meta.env?.BASE_URL || '/'
  // BASE_URL always ends in "/", so this joins cleanly
  return `${base}${encodeURIComponent(TRACK.fileName)}`
}

const FADE_MS = 2600
const TARGET_VOLUME = 0.62

/**
 * Why there is a blob fallback
 * ----------------------------
 * GitHub Pages answers Range requests with a full 200 response (a
 * documented Pages limitation). Streaming playback usually copes, but
 * Safari on iOS is strict about seeking and can refuse to play a media
 * file it cannot range-request. If that happens we fetch the file once
 * and hand the element a local object URL, which is fully seekable on
 * every browser.
 *
 * Streaming stays the default because it starts instantly; the 21.6 MB
 * download only happens if streaming has actually failed.
 */
let triedBlobFallback = false
let objectUrl = null

let audio = null
let listeners = new Set()

const state = {
  ready: false,
  playing: false,
  muted: false,
  volume: TARGET_VOLUME,
  currentTime: 0,
  duration: 0,
  error: null,
  loading: false,
  started: false,
}

/* ---------- subscription (useSyncExternalStore) ---------- */

export function subscribeSong(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function getSongState() {
  return state
}

/** Stable snapshot for useSyncExternalStore — same object until a real change. */
let snapshot = { ...state }

function emit(patch) {
  Object.assign(state, patch)
  snapshot = { ...state }
  listeners.forEach((fn) => fn())
}

/* ---------- the audio element ---------- */

function ensureAudio() {
  if (audio) return audio
  if (typeof window === 'undefined') return null

  audio = new window.Audio()
  audio.preload = 'auto'
  audio.loop = false
  audio.volume = 0
  audio.src = trackUrl()

  audio.addEventListener('loadedmetadata', () => {
    emit({ ready: true, duration: audio.duration || 0, error: null })
  })

  audio.addEventListener('durationchange', () => {
    emit({ duration: audio.duration || 0 })
  })

  audio.addEventListener('timeupdate', () => {
    // Time updates are frequent: update the snapshot without notifying
    // every frame, so React is not re-rendered 4× a second for a clock.
    state.currentTime = audio.currentTime
    snapshot = { ...snapshot, currentTime: state.currentTime }
  })

  audio.addEventListener('playing', () => emit({ playing: true, error: null }))
  audio.addEventListener('pause', () => emit({ playing: false }))
  audio.addEventListener('waiting', () => emit({ loading: true }))
  audio.addEventListener('canplay', () => emit({ loading: false }))
  audio.addEventListener('seeked', () => {
    state.currentTime = audio.currentTime
    snapshot = { ...snapshot, currentTime: state.currentTime }
  })
  audio.addEventListener('ended', () => emit({ playing: false, currentTime: 0 }))

  audio.addEventListener('error', () => {
    // A streaming failure may just be the missing range support — retry
    // once from a local blob before admitting defeat.
    if (!triedBlobFallback) {
      triedBlobFallback = true
      loadAsBlob()
      return
    }

    const code = audio.error?.code
    const messages = {
      1: 'Playback was interrupted.',
      2: 'The song could not be loaded — check your connection.',
      3: 'The song file could not be decoded.',
      4: 'This song format is not supported by your browser.',
    }
    emit({
      playing: false,
      loading: false,
      error: messages[code] || 'The song could not be played.',
    })
  })

  audio.load()
  emit({ loading: true })
  return audio
}

/**
 * Download the track and play it from a local object URL. Used only as a
 * fallback when the stream cannot be played (typically iOS over Pages).
 */
async function loadAsBlob() {
  try {
    emit({ loading: true, error: null })
    const res = await fetch(trackUrl())
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const blob = await res.blob()
    if (!blob.size) throw new Error('Empty file')

    if (objectUrl) URL.revokeObjectURL(objectUrl)
    objectUrl = URL.createObjectURL(blob)
    audio.src = objectUrl

    const wasPlaying = state.playing || state.started
    await audio.play()
    emit({ playing: true, loading: false, error: null })
    if (wasPlaying && !state.muted) {
      audio.volume = state.volume
    }
  } catch {
    emit({
      playing: false,
      loading: false,
      error: 'The song could not be loaded — check your connection.',
    })
  }
}

/* ---------- fade helpers ---------- */

let fadeTimer = 0

function fadeTo(targetVolume, ms = FADE_MS, onDone) {
  if (!audio) return
  clearInterval(fadeTimer)

  const from = audio.volume
  const to = Math.max(0, Math.min(1, targetVolume))
  if (ms <= 0) {
    audio.volume = to
    onDone?.()
    return
  }

  const start = performance.now()
  fadeTimer = setInterval(() => {
    const t = Math.min(1, (performance.now() - start) / ms)
    // Ease-out so the arrival feels gentle rather than linear
    const eased = 1 - Math.pow(1 - t, 3)
    audio.volume = from + (to - from) * eased
    if (t >= 1) {
      clearInterval(fadeTimer)
      onDone?.()
    }
  }, 40)
}

/* ---------- public controls ---------- */

/**
 * Begin the song. Must be called from a user gesture (the ENTER button),
 * which is exactly how browsers require audio to start.
 */
export async function playSong({ fade = true } = {}) {
  const el = ensureAudio()
  if (!el) return

  // A previously saved mute preference should not block the first play
  if (state.muted) {
    el.muted = true
  }

  try {
    await el.play()
    emit({ started: true, error: null, loading: false })
    if (fade && !state.muted) {
      el.volume = 0
      fadeTo(TARGET_VOLUME, FADE_MS)
    } else if (!state.muted) {
      el.volume = TARGET_VOLUME
    }
  } catch (err) {
    // Autoplay policy rejections and decode failures both land here
    const blocked =
      err && (err.name === 'NotAllowedError' || err.name === 'AbortError')
    emit({
      playing: false,
      loading: false,
      error: blocked
        ? 'Tap play to allow sound in your browser.'
        : 'The song could not be played.',
    })
  }
}

export function pauseSong() {
  if (!audio) return
  clearInterval(fadeTimer)
  audio.pause()
}

export function togglePlay() {
  if (!audio) {
    playSong()
    return
  }
  if (state.playing) pauseSong()
  else playSong({ fade: false })
}

export function toggleMute() {
  if (!audio) {
    // Nothing has started yet — treat this as "start, muted"
    ensureAudio()
  }
  const next = !state.muted
  if (audio) audio.muted = next
  emit({ muted: next })
}

export function setVolume(next) {
  const v = Math.max(0, Math.min(1, next))
  emit({ volume: v })
  if (audio && !state.muted) {
    clearInterval(fadeTimer)
    // Keep the fade target in step with the slider
    audio.volume = v
  }
  if (v > 0 && state.muted) toggleMute()
}

export function seekTo(fraction) {
  if (!audio || !state.duration) return
  audio.currentTime = Math.max(0, Math.min(1, fraction)) * state.duration
  emit({ currentTime: audio.currentTime })
}

/** Exposed for the player's progress line. */
export function getAudioElement() {
  return audio
}

/** Server snapshot (SSR / no-audio environments). */
export function getServerSongState() {
  return snapshot
}
