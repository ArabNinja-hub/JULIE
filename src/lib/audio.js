/**
 * Interface sounds.
 *
 * Short, quiet blips for clicks, discoveries and footsteps. These are
 * synthesised on the fly — no files, no downloads — and are disabled by
 * default so they never compete with Juliet's song or surprise anyone.
 *
 * Juliet's music lives in `lib/song.js`; this module is only the tiny
 * UI layer and holds no music of its own.
 */

const PREF_KEY = 'juliet.uiSounds'

let ctx = null
let enabled = false
let master = null
const listeners = new Set()

function readPref() {
  try {
    return localStorage.getItem(PREF_KEY) === 'on'
  } catch {
    return false
  }
}

enabled = typeof window !== 'undefined' ? readPref() : false

function ensureContext() {
  if (ctx) return ctx
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  ctx = new AC()
  master = ctx.createGain()
  master.gain.value = 0.9
  master.connect(ctx.destination)
  return ctx
}

export function isUiSoundEnabled() {
  return enabled
}

export function subscribeUiSound(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function setUiSoundEnabled(next) {
  enabled = next
  try {
    localStorage.setItem(PREF_KEY, next ? 'on' : 'off')
  } catch {
    /* private mode — the preference just won't persist */
  }
  if (next) ensureContext()
  listeners.forEach((fn) => fn(enabled))
}

/** Short interface sound. Silent unless the visitor has turned it on. */
export function playUiSound(kind = 'click') {
  if (!enabled) return
  const context = ensureContext()
  if (!context) return
  if (context.state === 'suspended') context.resume()

  const now = context.currentTime

  const osc = context.createOscillator()
  const gain = context.createGain()
  const filter = context.createBiquadFilter()
  filter.type = 'bandpass'
  filter.Q.value = 1.1

  const presets = {
    click: { freq: 880, to: 660, dur: 0.11, vol: 0.05, type: 'triangle' },
    open: { freq: 420, to: 880, dur: 0.26, vol: 0.055, type: 'sine' },
    discover: { freq: 660, to: 1320, dur: 0.5, vol: 0.07, type: 'sine' },
    warp: { freq: 220, to: 60, dur: 0.7, vol: 0.06, type: 'triangle' },
    step: { freq: 96, to: 62, dur: 0.12, vol: 0.014, type: 'sine' },
  }
  const p = presets[kind] || presets.click

  osc.type = p.type
  osc.frequency.setValueAtTime(p.freq, now)
  osc.frequency.exponentialRampToValueAtTime(p.to, now + p.dur)
  filter.frequency.setValueAtTime(p.freq * 1.6, now)

  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(p.vol, now + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + p.dur)

  osc.connect(filter)
  filter.connect(gain)
  gain.connect(master)
  osc.start(now)
  osc.stop(now + p.dur + 0.05)
}
