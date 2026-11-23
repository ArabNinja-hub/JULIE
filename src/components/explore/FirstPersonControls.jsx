import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { terrainHeight, WORLD } from '../../lib/terrain'

const EYE_HEIGHT = 1.72

/**
 * Walking pace.
 *
 * The old numbers were set for a vehicle: 15 units/s is a hard jog and the
 * 30-unit sprint was a bullet — nothing on the ground could be read at that
 * speed, and the head bob was tuned to match. In a world where a metre is a
 * metre, 4.2 m/s is a brisk, purposeful walk and 7.4 is a run. Slower is
 * smoother, and the terrain gets to be seen.
 */
const WALK_SPEED = 4.2
const SPRINT_SPEED = 7.4

// Reaching speed quickly but never instantly, so starting and stopping
// have weight without feeling like ice.
const ACCEL = 5.5
const DECEL = 7.5

const LOOK_SPEED = 0.0026
const TOUCH_LOOK_SPEED = 0.0046
const PITCH_LIMIT = Math.PI * 0.42

// How fast the camera's heading catches up to the look input. Mouse look is
// applied to a target yaw and the camera eases toward it; without this the
// view snaps between frames and the walk feels mechanical.
const YAW_LAG = 18
const PITCH_LAG = 20

/**
 * First-person lunar traversal.
 *
 * Keyboard (WASD / arrows), drag-to-look (mouse or touch) and a virtual
 * joystick (DOM, via api.setMove) all feed one smoothed velocity vector.
 * The camera's feet are clamped to the procedural terrain height, so
 * craters are genuinely walked into and crater rims genuinely climbed.
 */
export default function FirstPersonControls({ api, onStep, isMobile }) {
  const { camera, gl } = useThree()

  const state = useRef({
    pos: { x: 0, z: 0 },
    // yaw/pitch are what the camera uses; targetYaw/targetPitch are where
    // the input wants them to be. The gap between the two is the smoothing.
    yaw: 0,
    pitch: -0.05,
    targetYaw: 0,
    targetPitch: -0.05,
    vel: { x: 0, z: 0 },
    joy: { x: 0, y: 0 },
    keys: new Set(),
    warp: null,
    // Gait: a phase accumulator, a stride counter and a smoothed amount of
    // head movement so starting and stopping never pops.
    gait: 0,
    bobAmount: 0,
    eye: null, // smoothed ground height underfoot
    lastGround: null, // ground height last frame, for detecting drops
    lastStepCycle: 0, // which gait half-cycle last fired a footstep
  })

  /* ---------- Expose an imperative API to the HUD ---------- */
  useEffect(() => {
    api.current = {
      teleport(x, z, lookX, lookZ, instant = false) {
        const s = state.current
        const yaw = Math.atan2(-(lookX - x), -(lookZ - z))
        if (instant) {
          s.pos.x = x
          s.pos.z = z
          s.yaw = yaw
          s.targetYaw = yaw
          s.pitch = -0.06
          s.targetPitch = -0.06
          s.vel.x = 0
          s.vel.z = 0
          s.warp = null
          s.gait = 0
          s.bobAmount = 0
          s.lastStepCycle = 0
          // Snap the smoothed eye height so we never drift through the ground
          s.eye = terrainHeight(x, z)
          s.lastGround = s.eye
        } else {
          s.warp = { x, z, t: 0, fromX: s.pos.x, fromZ: s.pos.z, yaw }
        }
      },
      setMove(x, y) {
        state.current.joy.x = x
        state.current.joy.y = y
      },
      getState() {
        const s = state.current
        return { x: s.pos.x, z: s.pos.z, yaw: s.yaw }
      },
      reset() {
        const s = state.current
        s.keys.clear()
        s.joy.x = 0
        s.joy.y = 0
      },
    }
    return () => {
      api.current = null
    }
  }, [api])

  /* ---------- Keyboard ---------- */
  useEffect(() => {
    const down = (e) => {
      const k = e.key.toLowerCase()
      if (
        ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)
      ) {
        // Don't hijack keys while typing or when a form control is focused
        const tag = document.activeElement?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA') return
        e.preventDefault()
        state.current.keys.add(k === ' ' ? ' ' : k)
      }
    }
    const up = (e) => {
      const k = e.key.toLowerCase()
      state.current.keys.delete(k === ' ' ? ' ' : k)
    }
    const blur = () => state.current.keys.clear()

    window.addEventListener('keydown', down, { passive: false })
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [])

  /* ---------- Drag to look (mouse + touch) ---------- */
  useEffect(() => {
    const el = gl.domElement
    let dragging = false
    let lastX = 0
    let lastY = 0
    let pointerId = null

    const onDown = (e) => {
      // Ignore clicks on HUD-style overlays that bubble here
      dragging = true
      pointerId = e.pointerId
      lastX = e.clientX
      lastY = e.clientY
      el.setPointerCapture?.(e.pointerId)
      el.style.cursor = 'grabbing'
    }

    const onMove = (e) => {
      if (!dragging || e.pointerId !== pointerId) return
      const dx = e.clientX - lastX
      const dy = e.clientY - lastY
      lastX = e.clientX
      lastY = e.clientY

      const speed = e.pointerType === 'touch' ? TOUCH_LOOK_SPEED : LOOK_SPEED
      const st = state.current
      // Input moves the *target*; useFrame eases the camera toward it.
      st.targetYaw -= dx * speed
      st.targetPitch -= dy * speed
      st.targetPitch = Math.max(
        -PITCH_LIMIT,
        Math.min(PITCH_LIMIT, st.targetPitch)
      )
    }

    const onUp = (e) => {
      if (e.pointerId !== pointerId) return
      dragging = false
      pointerId = null
      el.style.cursor = 'grab'
    }

    el.style.cursor = 'grab'
    el.style.touchAction = 'none'
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)

    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
    }
  }, [gl])

  /* ---------- Per-frame integration ---------- */
  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05)
    const s = state.current

    /* --- cinematic warp between destinations --- */
    if (s.warp) {
      s.warp.t = Math.min(1, s.warp.t + delta / 1.5)
      const t = s.warp.t
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
      s.pos.x = s.warp.fromX + (s.warp.x - s.warp.fromX) * ease
      s.pos.z = s.warp.fromZ + (s.warp.z - s.warp.fromZ) * ease
      s.pitch = -0.06 - Math.sin(t * Math.PI) * 0.12
      s.targetPitch = s.pitch

      const targetYaw = s.warp.yaw
      let diff = ((targetYaw - s.yaw + Math.PI) % (Math.PI * 2)) - Math.PI
      if (diff < -Math.PI) diff += Math.PI * 2
      s.yaw += diff * Math.min(1, delta * 3)

      if (s.warp.t >= 1) {
        s.yaw = targetYaw
        s.targetYaw = targetYaw
        s.warp = null
      }

      const gh = terrainHeight(s.pos.x, s.pos.z)
      if (s.eye === null) s.eye = gh
      s.eye += (gh - s.eye) * Math.min(1, 8 * delta)

      camera.position.set(
        s.pos.x,
        s.eye + EYE_HEIGHT,
        s.pos.z
      )
      camera.rotation.order = 'YXZ'
      camera.rotation.set(s.pitch, s.yaw, 0)
      return
    }

    /* --- input → desired direction --- */
    const k = s.keys
    let forward = 0
    let strafe = 0
    if (k.has('w') || k.has('arrowup')) forward += 1
    if (k.has('s') || k.has('arrowdown')) forward -= 1
    if (k.has('a') || k.has('arrowleft')) strafe -= 1
    if (k.has('d') || k.has('arrowright')) strafe += 1

    // Virtual joystick (touch) adds to keyboard input
    forward += s.joy.y
    strafe += s.joy.x

    const mag = Math.hypot(forward, strafe)
    if (mag > 1) {
      forward /= mag
      strafe /= mag
    }

    const sprinting = k.has(' ') || (Math.hypot(s.joy.x, s.joy.y) > 0.9 && isMobile)
    const speed = sprinting ? SPRINT_SPEED : WALK_SPEED

    // Direction in world space, relative to where she's facing
    const sin = Math.sin(s.yaw)
    const cos = Math.cos(s.yaw)

    const dirX = (-sin * forward + cos * strafe) * speed
    const dirZ = (-cos * forward - sin * strafe) * speed

    // Accelerate toward the target, decelerate when there is no input.
    // Asymmetric on purpose: a walk starts with intent and stops promptly.
    const wants = Math.hypot(dirX, dirZ) > 0.001
    const rate = (wants ? ACCEL : DECEL) * delta
    s.vel.x += (dirX - s.vel.x) * Math.min(1, rate)
    s.vel.z += (dirZ - s.vel.z) * Math.min(1, rate)

    s.pos.x += s.vel.x * delta
    s.pos.z += s.vel.z * delta

    // Stay on the mapped surface
    const b = WORLD.bound
    s.pos.x = Math.max(-b, Math.min(b, s.pos.x))
    s.pos.z = Math.max(-b, Math.min(b, s.pos.z))

    /* --- terrain following --------------------------------------------
       Two layers of smoothing, because raw heightfield tracking is what
       made walking feel like a lift.

       1. Sample the ground ahead along the direction of travel, so the
          camera rises into a slope before its feet reach it rather than
          being shoved up a wall.
       2. Critically damped follow toward that target. Rising is slower
          than falling (you climb, you settle), but neither is a snap. The
          old code snapped descents at 16x, which on rough regolith fired
          a downward jerk every few steps.
    ------------------------------------------------------------------- */
    const ground = terrainHeight(s.pos.x, s.pos.z)

    const spd = Math.hypot(s.vel.x, s.vel.z)
    const ahead = Math.min(1.1, spd * 0.12)
    const inv = spd > 0.001 ? 1 / spd : 0
    const lookX = s.pos.x + s.vel.x * inv * ahead
    const lookZ = s.pos.z + s.vel.z * inv * ahead
    const target = Math.max(ground, terrainHeight(lookX, lookZ))

    if (s.eye === null) s.eye = target

    /* A drop is a slope, not a switch.
     *
     * This used to be a binary `dropping` flag, which doubled the follow
     * rate the instant the ground tipped downward by 5 cm. Measured, that
     * snapped the camera from -2.5 to -3.4 m/s between two frames — a
     * 54 m/s² jolt, and the last real jolt in the walk. Expressing it as a
     * continuous amount removes the discontinuity entirely.
     */
    const falloff =
      s.lastGround === null
        ? 0
        : Math.min(1, Math.max(0, (s.lastGround - target) / 0.35))
    s.lastGround = target

    /* Speed-aware smoothing.
     *
     * A fixed follow rate is wrong at both ends: gentle enough for a crater
     * rim is too sluggish to climb a massif, and quick enough for a massif
     * turns every metre-wide undulation into a jolt. Real walking filters
     * small bumps out and still lets you climb a hill.
     *
     *   • small deviations (under ~0.6 m) are eased slowly — these are the
     *     ground's texture and must not reach the camera at all
     *   • large deviations are followed briskly, so a genuine slope or a
     *     step down is obeyed rather than floated over
     *   • falling is always a little quicker than rising
     */
    const gap = target - s.eye
    const magnitude = Math.min(1, Math.abs(gap) / 0.6)
    // Falling gets a smooth boost, never a step change.
    const base = gap > 0 ? 2.6 : 3.4 + falloff * 2.0
    const followRate = (base + magnitude * 4.2) * delta
    s.eye += gap * Math.min(1, followRate)

    /* --- gait ---------------------------------------------------------
       A walk cycle, not a sine wave on the camera height. The amount of
       movement ramps in and out with speed, so she accelerates into a
       stride and settles out of it. Vertical bob runs at twice the stride
       rate (one dip per footfall), with a little lateral sway and a slight
       roll — the things your body actually does, and the reason a walking
       camera reads as alive.
    ------------------------------------------------------------------- */
    const moving = spd > 0.35
    const speedFactor = Math.min(1, spd / WALK_SPEED)

    // Stride frequency: faster pace, quicker cadence, but sub-linear
    const strideHz = sprinting ? 2.15 : 1.72
    if (moving) s.gait += delta * Math.PI * 2 * strideHz * speedFactor

    // Ramp the bob in and out rather than switching it
    s.bobAmount += ((moving ? speedFactor : 0) - s.bobAmount) * Math.min(1, delta * 6)

    // Amplitudes are set by the acceleration they produce, not by eye.
    // A sinusoid of amplitude A at frequency f peaks at A*(2πf)². The old
    // 0.052 m at 3.44 Hz was 24 m/s² — a jackhammer, and the single biggest
    // reason walking felt mechanical. Human head movement sits around
    // 1–2.5 m/s²; 0.011 m gives about 5, which settles under the terrain
    // smoothing into something that reads as a stride rather than a bounce.
    // Sway and roll are similarly derived: they should be felt, not seen.
    const bobY = Math.sin(s.gait * 2) * 0.011 * s.bobAmount
    const swayX = Math.sin(s.gait) * 0.021 * s.bobAmount
    const roll = Math.sin(s.gait) * 0.0042 * s.bobAmount

    /* --- eased look --------------------------------------------------- */
    const yawLerp = Math.min(1, delta * YAW_LAG)
    const pitchLerp = Math.min(1, delta * PITCH_LAG)

    // Take the short way round when yaw wraps past ±π
    let dYaw = ((s.targetYaw - s.yaw + Math.PI) % (Math.PI * 2)) - Math.PI
    if (dYaw < -Math.PI) dYaw += Math.PI * 2
    s.yaw += dYaw * yawLerp
    s.pitch += (s.targetPitch - s.pitch) * pitchLerp

    /* --- camera ------------------------------------------------------- */
    const sinY = Math.sin(s.yaw)
    const cosY = Math.cos(s.yaw)
    camera.position.set(
      s.pos.x + cosY * swayX,
      s.eye + EYE_HEIGHT + bobY,
      s.pos.z - sinY * swayX
    )
    camera.rotation.order = 'YXZ'
    camera.rotation.set(s.pitch, s.yaw, roll)

    /* --- footsteps ----------------------------------------------------- */
    // Driven by the gait itself: a step lands when the bob passes its low
    // point, which is exactly when a real footfall happens.
    if (moving && s.bobAmount > 0.25) {
      const cycle = Math.floor(s.gait / Math.PI)
      if (cycle !== s.lastStepCycle) {
        s.lastStepCycle = cycle
        onStep?.()
      }
    }
  })

  return null
}
