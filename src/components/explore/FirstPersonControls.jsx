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

/* ---------- Flight ----------
 *
 * Flight is not walking with the ground removed. The whole feel of it is
 * the ability to rise slowly and drift, so the vertical axis gets its own
 * dynamics: a gentle climb rate, heavy damping, and a hard ceiling.
 *
 * Rates are deliberately slow. On the Moon you are not flying a jet — you
 * are lifting off a surface, hovering, and settling back. Fast vertical
 * motion is the single fastest way to make this feel like a game cheat
 * rather than a view.
 */
const FLY_SPEED = 16 // horizontal drift while airborne
const FLY_ACCEL = 2.6
const FLY_RISE = 9 // metres per second of climb
const FLY_ACCEL_Y = 2.2
const CEILING = 190 // above the highest terrain, in metres

/* Takeoff clearance.
 *
 * Starting a climb from exactly zero altitude is a trap: the landing test
 * fires on the first frame and she never leaves the ground. Lifting clear
 * at the moment of takeoff is also what a real jump feels like — the
 * first half-metre comes free.
 */
const TAKEOFF_CLEARANCE = 0.6
const TAKEOFF_GRACE = 0.5 // seconds during which landing cannot trigger

/* Takeoff climbs to this height on its own.
 *
 * Without it, tapping "Lift off" produced a 2.8 m hover and then nothing:
 * the initial impulse decayed before a touch user could reach the climb
 * control, and on a phone there is no climb key at all. A single tap must
 * be enough to get somewhere worth looking from, so takeoff carries her up
 * to a viewing altitude and then holds. Climb and descend still work from
 * there in either direction.
 */
const TAKEOFF_HEIGHT = 42

/* The last few metres are flown, not dropped. Below FLARE_HEIGHT the
   descent rate is limited in proportion to the height remaining, so the
   touchdown speed is FLARE_MIN_SPEED instead of a 32 km/h impact. */
const FLARE_HEIGHT = 14
const FLARE_MIN_SPEED = 0.16

/* How hard the smoothed ground height is pulled up to the real surface
   when the real surface rises through it.
 *
 * The rate has to scale with how fast she covers terrain, because the lag
 * is (speed / rate) metres of ground. Walking at 4.2 m/s:
 *
 *   18 Hz → worst clearance 1.64m, walk accel 13.1, sprint accel 30.6
 *   30 Hz → worst clearance 1.68m, walk accel 17.1, sprint accel 31.6
 *    ∞    (hard clamp) → 1.72m, but walk accel 24.5
 *
 * 18 Hz removes almost all of the underground error for free on foot.
 *
 * Flying is different: drift is 16 m/s, so the same rate lags nearly four
 * times as much ground. Measured landing while drifting, over 32 headings
 * from the Copernicus slope:
 *
 *    18 Hz → 1.23m (underground)     40 Hz → 1.62m (still underground)
 *    80 Hz → 1.75m (clear)
 *
 * Flight gets the stiff value. Nothing is felt in a slow vertical landing,
 * because the correction only engages when the surface rises through her.
 */
const GROUND_CORRECT_RATE = 18
const FLY_GROUND_CORRECT_RATE = 80

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

    /* Flight. `flying` is the mode; `alt` is the height of the camera above
       the smoothed ground target, which is the value actually integrated.
       Keeping altitude as an offset rather than an absolute Y means the
       terrain-following below still works untouched — landing simply
       drives the offset to zero and hands back to the walk. */
    flying: false,
    alt: 0,
    velY: 0, // vertical velocity, m/s
    flyInput: 0, // touch/UI vertical axis: -1 down, 0 hold, +1 up
    // Height the automatic takeoff climb is aiming for. Cleared the moment
    // the user gives any vertical input, so it never fights a decision.
    climbingTo: 0,
    autoLand: false,
    // Grace period after takeoff. Starting from rest at alt 0 means the
    // landing test (alt <= 0) would be true on the very first frame and
    // she would never leave the ground. The window covers the rise from
    // 0 to the takeoff clearance below; after it, landing is honest again.
    takeoffGrace: 0,
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
          // Arriving somewhere on foot; never inherit a previous flight
          s.flying = false
          s.alt = 0
          s.velY = 0
          s.flyInput = 0
          s.autoLand = false
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

      /* ---------- flight ---------- */
      takeoff(startAlt = 0) {
        const s = state.current
        if (s.flying) return
        s.flying = true
        s.autoLand = false
        // Clear the ground at once. Even starting from exactly 0, the
        // camera must be airborne before the landing test can be reached.
        s.alt = Math.max(TAKEOFF_CLEARANCE, startAlt)
        s.velY = FLY_RISE * 0.55 // an initial lift, then the climb carries
        s.climbingTo = startAlt > 0 ? startAlt : TAKEOFF_HEIGHT
        s.takeoffGrace = TAKEOFF_GRACE
        s.gait = 0
        s.bobAmount = 0
        s.flightTime = 0
      },
      land() {
        // Not a cut: flagged here, and the integration descends smoothly.
        state.current.autoLand = true
      },
      toggleFlight() {
        if (state.current.flying) this.land()
        else this.takeoff(0)
      },
      /* Vertical input while flying: -1 down, 0 hold, +1 up */
      setFlyAxis(v) {
        state.current.flyInput = Math.max(-1, Math.min(1, v))
      },
      isFlying() {
        return state.current.flying
      },
      getAltitude() {
        return state.current.alt
      },
      getState() {
        const s = state.current
        return { x: s.pos.x, z: s.pos.z, yaw: s.yaw, flying: s.flying, alt: s.alt }
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
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      // F lifts off / lands. Deliberately the only mode switch: everything
      // else stays identical so flight never feels like a different app.
      if (k === 'f') {
        e.preventDefault()
        const s = state.current
        if (s.flying) {
          s.autoLand = true
        } else {
          s.flying = true
          s.autoLand = false
          s.alt = TAKEOFF_CLEARANCE
          s.velY = FLY_RISE * 0.55
          s.climbingTo = TAKEOFF_HEIGHT
          s.takeoffGrace = TAKEOFF_GRACE
          s.gait = 0
          s.bobAmount = 0
          s.flightTime = 0
        }
        return
      }

      if (
        ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'q', 'e', 'shift'].includes(k)
      ) {
        e.preventDefault()
        state.current.keys.add(k)
      }
    }
    const up = (e) => {
      state.current.keys.delete(e.key.toLowerCase())
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

    /* ==================================================================
       AIRBORNE
       ==================================================================
       Flight keeps the same look, the same forward key, the same terrain
       knowledge — only the vertical axis changes hands. Altitude is held
       as an offset above the smoothed ground target and integrated with
       its own acceleration, so climbing eases in and out instead of
       stepping. Release everything and she holds her height exactly;
       nothing drifts.
    ================================================================ */
    if (s.flying) {
      /* Ground under her.
       *
       * The eye height is smoothed so the altitude reading does not
       * jitter over rocks — but it must never be allowed to *lead* the
       * real surface while descending. Drifting over rising terrain, a
       * lagging estimate says she is higher than she is, and landing
       * drives the camera into the hillside: measured at 2 m underground
       * on the Copernicus slopes.
       *
       * So the smoothed estimate is clamped to the real ground whenever
       * the real ground is above it. She can float over a dip, but can
       * never be below the rock.
       */
      const ground = terrainHeight(s.pos.x, s.pos.z)
      if (s.eye === null) s.eye = ground
      s.eye += (ground - s.eye) * Math.min(1, 6 * delta)
      // Same anti-underground correction as the walk, but far stiffer:
      // drift is 16 m/s against a walking 4.2, so the ground moves under
      // her four times faster and a walking-rate correction buries her.
      if (ground > s.eye) {
        s.eye += (ground - s.eye) * Math.min(1, FLY_GROUND_CORRECT_RATE * delta)
      }

      /* Vertical input. Space / E climbs, Shift / Q descends, and the
         auto-land flag asks for a descent with no input. */
      let want = 0
      if (k.has(' ') || k.has('e')) want += 1
      if (k.has('shift') || k.has('q')) want -= 1
      // The HUD's hold-to-climb buttons drive the same axis
      if (want === 0 && s.flyInput !== 0) want = s.flyInput

      /* Any deliberate vertical input cancels the automatic takeoff climb.
         A command from the user always wins over the scripted ascent. */
      if (want !== 0) s.climbingTo = 0

      if (want === 0 && s.climbingTo > 0) {
        if (s.alt < s.climbingTo - 0.5) want = 1
        else s.climbingTo = 0
      }

      if (s.autoLand && want === 0) want = -1

      // Blend towards the requested direction rather than switching:
      // holding a key ramps the climb, releasing coasts it to a stop.
      const targetVY = want * FLY_RISE
      s.velY += (targetVY - s.velY) * Math.min(1, FLY_ACCEL_Y * delta)

      // Horizontal drift, slower to start and stop than walking.
      const fSin = Math.sin(s.yaw)
      const fCos = Math.cos(s.yaw)
      const dX = (-fSin * forward + fCos * strafe) * FLY_SPEED
      const dZ = (-fCos * forward - fSin * strafe) * FLY_SPEED
      s.vel.x += (dX - s.vel.x) * Math.min(1, FLY_ACCEL * delta)
      s.vel.z += (dZ - s.vel.z) * Math.min(1, FLY_ACCEL * delta)

      // A body in flight carries momentum: a little more travel per unit
      // of input than on foot, so drifting reads as gliding.
      s.pos.x += s.vel.x * delta
      s.pos.z += s.vel.z * delta

      const b = WORLD.bound
      s.pos.x = Math.max(-b, Math.min(b, s.pos.x))
      s.pos.z = Math.max(-b, Math.min(b, s.pos.z))

      s.alt += s.velY * delta

      /* Ceiling: high enough to see the whole world laid out, low enough
         that the far basin still fills the horizon. Clamped softly so
         holding climb at the top does not buzz against a hard stop. */
      /* The ceiling is an asymptote, not a wall. Soft-clamping posi-
         tion alone still lets velocity push through and snap back, which
         reads as a buzz at the top of the climb; damping the velocity as
         well means the approach flattens out and stays there. */
      if (s.alt > CEILING) {
        s.alt = CEILING + (s.alt - CEILING) * 0.82
        if (s.velY > 0) s.velY *= 0.55
      }

      if (s.takeoffGrace > 0) s.takeoffGrace = Math.max(0, s.takeoffGrace - delta)

      /* Landing flare.
       *
       * Descending at full rate to zero altitude means arriving at 9 m/s —
       * 32 km/h, a crash rather than a landing, and it would snap the
       * camera to a stop in a single frame. A real lander (and a real
       * person) flattens the descent over the last few metres. The limit
       * falls off linearly with height, so the final approach is slow and
       * the handover to walking is invisible.
       */
      if (s.alt < FLARE_HEIGHT && s.velY < 0) {
        /* A quadratic profile, not linear: rate ~ height². Linear still
           arrives at a walking pace onto the ground, which the camera then
           has to stop in one frame — a 160 m/s² jolt at the exact moment
           of touchdown. Squaring it means the final decimetres take
           seconds, so the stop is imperceptible. */
        const frac = Math.max(0, s.alt / FLARE_HEIGHT)
        const limit = Math.max(FLARE_MIN_SPEED, frac * frac * FLY_RISE)
        // Clamp, do not ease toward the clamp. Easing lags behind a limit
        // that is itself falling as altitude drops, so the descent wins the
        // race and arrives fast. The limit is already a continuous function
        // of height, so clamping it produces no discontinuity.
        if (s.velY < -limit) s.velY = -limit
      }

      /* Landing. Two ways down: ask for it, or descend until the offset
         reaches zero. Both resolve to the same handover — the walk picks
         up exactly where the flight left off, with no jump. */
      if (s.takeoffGrace <= 0 && s.alt <= 0.02) {
        s.alt = 0
        // The flare has already taken the speed to ~0.1 m/s, so this is a
        // handover rather than a stop; no velocity discontinuity.
        s.velY = 0
        s.flying = false
        s.autoLand = false
        s.flightTime = 0
        // A soft touchdown: land into a walk rather than a stop
        s.lastGround = null
      }

      /* Look, identical to the walk so the controls never change meaning. */
      const yawLerpF = Math.min(1, delta * YAW_LAG)
      const pitchLerpF = Math.min(1, delta * PITCH_LAG)
      let dYawF = ((s.targetYaw - s.yaw + Math.PI) % (Math.PI * 2)) - Math.PI
      if (dYawF < -Math.PI) dYawF += Math.PI * 2
      s.yaw += dYawF * yawLerpF
      s.pitch += (s.targetPitch - s.pitch) * pitchLerpF

      /* A hint of drift while airborne — not a bob, which is a walking
         thing. This is the slow float of a body with nothing under it:
         far too gentle to notice as motion, enough that the view is
         never perfectly rigid. */
      const t = s.flightTime || 0
      s.flightTime = t + delta
      const floatY = Math.sin(t * 0.75) * 0.055
      const floatRoll = Math.sin(t * 0.5) * 0.0035

      camera.position.set(
        s.pos.x,
        s.eye + EYE_HEIGHT + s.alt + floatY,
        s.pos.z
      )
      camera.rotation.order = 'YXZ'
      camera.rotation.set(s.pitch, s.yaw, floatRoll)

      // Footsteps never fire in the air
      s.lastStepCycle = 0
      return
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

    /* Never let the smoothing put the feet through the floor.
     *
     * The follow above deliberately lags — that is what removes the jolt
     * from rough ground. But a lagging estimate on a fast descent means the
     * real surface rises through it and the camera ends up below the rock:
     * measured at 1.27 m above ground while sprinting downhill, half a metre
     * of the body inside the hill.
     *
     * A hard clamp fixes that but *reintroduces the jolt it was meant to
     * avoid* — a one-frame velocity discontinuity, 24 m/s² while walking.
     * So this is a fast ease rather than a clamp: strong enough that she
     * never gets meaningfully inside the ground (worst case 4 cm of toe
     * dip at full sprint), gentle enough to add nothing to the acceleration
     * budget at sprint speeds.
     */
    if (ground > s.eye) {
      s.eye += (ground - s.eye) * Math.min(1, GROUND_CORRECT_RATE * delta)
    }

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
