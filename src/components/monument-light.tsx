import { useEffect, useRef } from 'react'
import { hasMonument, monumentReach } from '#/components/player-monument'
import type { Standing } from '#/components/player-monument'

/* The half of the monument that is light rather than ink — part of the same
   single amber moment, not an exemption from it. What belongs to the player is
   how far the pool spreads: as far as the reign it stands for.

   Sized for a wide pane: the circle is measured against the pane's farthest
   corner, so a taller-than-wide one cuts the ramp mid-fade into a hard seam. */
export function MonumentLight({ standing }: { standing: Standing }) {
  const ref = useRef<HTMLDivElement>(null)
  const lit = hasMonument(standing)

  /* The light answers the pointer the way the hall's scene does. Whether it may
     move at all is CSS's call — this only ever writes the coordinates.

     Keyed on `lit` rather than mounted once: the router keeps this tree mounted
     across a slug change, so a player with no monument followed by one with a
     monument would otherwise leave the listeners never attached, and the
     reverse would leave them writing into a detached node. */
  useEffect(() => {
    const layer = ref.current
    const pane = layer?.parentElement
    if (!pane) return
    if (!window.matchMedia('(pointer: fine)').matches) return

    let frame = 0
    let at: { x: number; y: number } | null = null
    // Measured inside the frame, after the browser has flushed our own writes:
    // reading the box in the move handler forces a layout on every event.
    const settle = () => {
      frame = 0
      const box = pane.getBoundingClientRect()
      if (!box.width || !box.height) return
      const x = at ? (at.x - box.left) / box.width - 0.5 : 0
      const y = at ? (at.y - box.top) / box.height - 0.5 : 0
      layer.style.setProperty('--light-x', x.toFixed(3))
      layer.style.setProperty('--light-y', y.toFixed(3))
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(settle)
    }
    // A touchscreen laptop reports a fine pointer and still fires pointermove
    // through a scroll, which would lurch the light down the page with it.
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      at = { x: e.clientX, y: e.clientY }
      schedule()
    }
    const onLeave = () => {
      at = null
      schedule()
    }

    pane.addEventListener('pointermove', onMove)
    pane.addEventListener('pointerleave', onLeave)
    return () => {
      pane.removeEventListener('pointermove', onMove)
      pane.removeEventListener('pointerleave', onLeave)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [lit])

  // No tenure and nothing standing is no subject, and the light answers to that
  // for the same reason the numeral does.
  if (!lit) return null

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="monument-light absolute inset-0 z-0 hidden overflow-hidden rounded-[inherit] md:block"
      style={
        { '--monument-reach': monumentReach(standing) } as React.CSSProperties
      }
    >
      <div className="monument-glow" />
    </div>
  )
}
