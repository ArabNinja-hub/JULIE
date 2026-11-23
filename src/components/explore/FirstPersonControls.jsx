import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { terrainHeight, WORLD } from '../../lib/terrain'

const EYE_HEIGHT = 1.75
const WALK_SPEED = 15
const SPRINT_SPEED = 30
const ACCEL = 9
const LOOK_SPEED = 0.0032
const TOUCH_LOOK_SPEED = 0.0055
const PITCH_LIMIT = Math.PI * 0.44

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
    yaw: 0,
    pitch: -0.05,
    vel: { x: 0, z: 0 },
    joy: { x: 0, y: 0 },
    keys: new Set(),
    warp: null,
    stepTimer: 0,
    bob: 0,
    eye: null, // smoothed ground height underfoot
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
          s.pitch = -0.06
          s.vel.x = 0
          s.vel.z = 0
          s.warp = null
          // Snap the smoothed eye height so we never drift through the ground
          s.eye = terrainHeight(x, z)
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
      const s = state.current
      s.yaw -= dx * speed
      s.pitch -= dy * speed
      s.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, s.pitch))
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

      const targetYaw = s.warp.yaw
      let diff = ((targetYaw - s.yaw + Math.PI) % (Math.PI * 2)) - Math.PI
      if (diff < -Math.PI) diff += Math.PI * 2
      s.yaw += diff * Math.min(1, delta * 3)

      if (s.warp.t >= 1) {
        s.yaw = targetYaw
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

    const sprinting = k.has(' ') || (mag > 0.9 && isMobile)
    const speed = sprinting ? SPRINT_SPEED : WALK_SPEED

    // Direction in world space, relative to where she's facing
    const sin = Math.sin(s.yaw)
    const cos = Math.cos(s.yaw)

    const dirX = (-sin * forward + cos * strafe) * speed
    const dirZ = (-cos * forward - sin * strafe) * speed

    // Smooth acceleration toward the target velocity
    s.vel.x += (dirX - s.vel.x) * Math.min(1, ACCEL * delta)
    s.vel.z += (dirZ - s.vel.z) * Math.min(1, ACCEL * delta)

    s.pos.x += s.vel.x * delta
    s.pos.z += s.vel.z * delta

    // Stay on the mapped surface
    const b = WORLD.bound
    s.pos.x = Math.max(-b, Math.min(b, s.pos.x))
    s.pos.z = Math.max(-b, Math.min(b, s.pos.z))

    /* --- ground clamp + head bob + footsteps --- */
    const ground = terrainHeight(s.pos.x, s.pos.z)

    // Smooth the height underfoot: crater walls are steep, and tracking
    // the raw heightfield would jolt the camera on every step. Sampling
    // slightly ahead in the direction of travel means she also *sees* the
    // ground rise before she reaches it, instead of being pushed up a wall.
    const ahead = Math.min(0.6, Math.hypot(s.vel.x, s.vel.z) * 0.035)
    const lookX = s.pos.x + (s.vel.x / (Math.hypot(s.vel.x, s.vel.z) || 1)) * ahead
    const lookZ = s.pos.z + (s.vel.z / (Math.hypot(s.vel.x, s.vel.z) || 1)) * ahead
    const target = Math.max(ground, terrainHeight(lookX, lookZ))

    if (s.eye === null) s.eye = target
    // Rising is always smooth. Falling snaps quickly, so she never
    // floats above a crater lip or hovers over a slope she just left.
    const descent = target < s.eye
    s.eye += (target - s.eye) * Math.min(1, (descent ? 16 : 9) * delta)

    const moving = Math.hypot(s.vel.x, s.vel.z) > 1.2

    s.bob += delta * (moving ? Math.hypot(s.vel.x, s.vel.z) * 0.55 : 0)
    const bobY = moving ? Math.sin(s.bob) * 0.055 : 0

    camera.position.set(
      s.pos.x,
      s.eye + EYE_HEIGHT + bobY,
      s.pos.z
    )
    camera.rotation.order = 'YXZ'
    camera.rotation.set(s.pitch, s.yaw, 0)

    if (moving) {
      s.stepTimer += delta
      const interval = sprinting ? 0.34 : 0.52
      if (s.stepTimer > interval) {
        s.stepTimer = 0
        onStep?.()
      }
    } else {
      s.stepTimer = 0.3
    }
  })

  return null
}
