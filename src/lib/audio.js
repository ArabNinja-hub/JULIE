/**
 * Procedural ambient audio — no files to download, nothing autoplays.
 *
 * The AudioContext is only created inside a user gesture (the sound
 * toggle). Until then this module holds no audio resources at all.
 *
 * The ambient bed is a slow, drifting drone: three detuned oscillators
 * through a low-pass filter, gently breathed by an LFO, plus a
 * feedback delay for space. UI sounds are short filtered blips.
 */

let ctx = null
let master = null
let ambient = null
let enabled = false
const listeners = new Set()

function ensureContext() {
  if (ctx) return ctx
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  ctx = new AC()
  master = ctx.createGain()
  master.gain.value = 0
  master.connect(ctx.destination)
  return ctx
}

function buildAmbient() {
  if (!ctx) return null

  const out = ctx.createGain()
  out.gain.value = 0

  // Gentle low-pass to keep everything soft and distant
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 700
  filter.Q.value = 0.6

  filter.connect(out)
  out.connect(master)

  // Three drifting voices — a wide, slow chord (A minor-ish, very low)
  const voices = [55, 82.4, 110, 164.8]
  const oscs = voices.map((freq, i) => {
    const osc = ctx.createOscillator()
    osc.type = i % 2 === 0 ? 'sine' : 'triangle'
    osc.frequency.value = freq
    osc.detune.value = (i - 1.5) * 6

    const g = ctx.createGain()
    g.gain.value = 0.16 / (i + 1.4)
    osc.connect(g)
    g.connect(filter)

    // Slow independent tremolo per voice
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.03 + i * 0.017
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 0.05 / (i + 1.4)
    lfo.connect(lfoGain)
    lfoGain.connect(g.gain)

    osc.start()
    lfo.start()
    return { osc, lfo }
  })

  // Space: a feedback delay on a parallel path
  const delay = ctx.createDelay(1.5)
  delay.delayTime.value = 0.55
  const fb = ctx.createGain()
  fb.gain.value = 0.42
  const wet = ctx.createGain()
  wet.gain.value = 0.28
  filter.connect(delay)
  delay.connect(fb)
  fb.connect(delay)
  delay.connect(wet)
  wet.connect(master)

  return { out, oscs, delay }
}

function ramp(node, value, seconds) {
  if (!node || !ctx) return
  const now = ctx.currentTime
  node.gain.cancelScheduledValues(now)
  node.gain.setValueAtTime(node.gain.value, now)
  node.gain.linearRampToValueAtTime(value, now + seconds)
}

export function isAudioEnabled() {
  return enabled
}

export function subscribeAudio(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function emit() {
  listeners.forEach((fn) => fn(enabled))
}

/** Toggle ambient audio. Must be called from a user gesture the first time. */
export async function toggleAmbient() {
  const context = ensureContext()
  if (!context) return false

  if (context.state === 'suspended') await context.resume()

  if (!ambient) ambient = buildAmbient()

  enabled = !enabled
  ramp(ambient.out, enabled ? 0.55 : 0, enabled ? 2.4 : 1.4)
  ramp(master, enabled ? 1 : 0, enabled ? 1.6 : 1.0)
  emit()
  return enabled
}

export function setAmbientEnabled(next) {
  if (!ctx || !ambient) return
  enabled = next
  ramp(ambient.out, next ? 0.55 : 0, next ? 2.4 : 1.4)
  ramp(master, next ? 1 : 0, next ? 1.6 : 1.0)
  emit()
}

/** Short interface sound. Silent unless the user has enabled audio. */
export function playUiSound(kind = 'click') {
  if (!enabled || !ctx) return
  const now = ctx.currentTime

  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.Q.value = 1.1

  const presets = {
    click: { freq: 880, to: 660, dur: 0.11, vol: 0.055, type: 'triangle' },
    open: { freq: 420, to: 880, dur: 0.26, vol: 0.06, type: 'sine' },
    discover: { freq: 660, to: 1320, dur: 0.5, vol: 0.075, type: 'sine' },
    warp: { freq: 220, to: 60, dur: 0.7, vol: 0.07, type: 'triangle' },
    step: { freq: 96, to: 62, dur: 0.12, vol: 0.016, type: 'sine' },
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
