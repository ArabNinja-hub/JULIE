import { useCallback, useRef } from 'react'
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react'

/**
 * Virtual joystick for touch devices (also usable with a mouse).
 * Feeds a normalised vector into the first-person controller.
 */
export default function Joystick({ onMove }) {
  const baseRef = useRef(null)
  const knobRef = useRef(null)
  const active = useRef(false)
  const pointerId = useRef(null)

  const apply = useCallback(
    (clientX, clientY) => {
      const base = baseRef.current
      const knob = knobRef.current
      if (!base || !knob) return
      const rect = base.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const max = rect.width / 2 - 14

      let dx = clientX - cx
      let dy = clientY - cy
      const dist = Math.hypot(dx, dy)
      if (dist > max) {
        dx = (dx / dist) * max
        dy = (dy / dist) * max
      }
      knob.style.transform = `translate(${dx}px, ${dy}px)`
      onMove(dx / max, -dy / max)
    },
    [onMove]
  )

  const stop = useCallback(() => {
    active.current = false
    pointerId.current = null
    if (knobRef.current) knobRef.current.style.transform = 'translate(0,0)'
    onMove(0, 0)
  }, [onMove])

  return (
    <div className="joystick" aria-hidden="true">
      <div
        ref={baseRef}
        className="joystick__base"
        onPointerDown={(e) => {
          active.current = true
          pointerId.current = e.pointerId
          e.currentTarget.setPointerCapture(e.pointerId)
          apply(e.clientX, e.clientY)
        }}
        onPointerMove={(e) => {
          if (!active.current || e.pointerId !== pointerId.current) return
          apply(e.clientX, e.clientY)
        }}
        onPointerUp={stop}
        onPointerCancel={stop}
        onPointerLeave={(e) => {
          if (active.current && e.pointerId === pointerId.current) stop()
        }}
      >
        <span className="joystick__dir joystick__dir--u">
          <ArrowUp size={12} />
        </span>
        <span className="joystick__dir joystick__dir--d">
          <ArrowDown size={12} />
        </span>
        <span className="joystick__dir joystick__dir--l">
          <ArrowLeft size={12} />
        </span>
        <span className="joystick__dir joystick__dir--r">
          <ArrowRight size={12} />
        </span>
        <span ref={knobRef} className="joystick__knob" />
      </div>
    </div>
  )
}
