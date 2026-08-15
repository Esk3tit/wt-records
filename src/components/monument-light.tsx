import { useEffect, useRef, useState } from 'react'
import {
  hasMonument,
  monumentReach,
  monumentStanding,
} from '#/components/player-monument'
import type { Standing } from '#/components/player-monument'

/* The half of the monument that is light rather than ink — part of the same
   single amber moment, not an exemption from it, and the only thing on this
   card drawn from the reign itself: the pool reaches as far as the tenure ran,
   and it breathes only while that tenure is still running.

   Sized for a wide pane: the circle is measured against the pane's farthest
   corner, so a taller-than-wide one cuts the ramp mid-fade into a hard seam. */
export function MonumentLight({ standing }: { standing: Standing }) {
  const ref = useRef<HTMLDivElement>(null)
  // React owns className, so the observer reports through state rather than
  // writing the attribute underneath it and losing the flag on the next render.
  const [offscreen, setOffscreen] = useState(false)
  const alive = monumentStanding(standing)

  /* The light answers the pointer the way the hall's scene does — a few percent,
     trailing rather than tracking, which is what keeps it from reading as
     jitter. Fine pointers only: a thumb has no hover to answer with. */
  useEffect(() => {
    const layer = ref.current
    const pane = layer?.parentElement
    if (!pane) return
    if (!window.matchMedia('(pointer: fine)').matches) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

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
    const onMove = (e: PointerEvent) => {
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
  }, [])

  /* A loop nobody is looking at is a loop that should not be running. */
  useEffect(() => {
    const layer = ref.current
    if (!layer || !alive) return
    if (typeof IntersectionObserver === 'undefined') return
    const watch = new IntersectionObserver(([seen]) =>
      setOffscreen(!seen.isIntersecting),
    )
    watch.observe(layer)
    return () => watch.disconnect()
  }, [alive])

  // No tenure and nothing standing is no subject, and the glow answers to that
  // for the same reason the numeral does.
  if (!hasMonument(standing)) return null

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={[
        'monument-light absolute inset-0 z-0 hidden overflow-hidden rounded-[inherit] md:block',
        alive && 'monument-light--standing',
        offscreen && 'is-offscreen',
      ]
        .filter(Boolean)
        .join(' ')}
      style={
        { '--monument-reach': monumentReach(standing) } as React.CSSProperties
      }
    >
      <div className="monument-glow" />
    </div>
  )
}
