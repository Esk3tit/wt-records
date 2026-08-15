import { useEffect, useRef } from 'react'

/* The light the monument stands in. Amber material behind the glass, never ink,
   so it spends none of the page's ration — and the one thing on this card drawn
   from the reign it belongs to: the pool reaches as far as the tenure ran, and
   it breathes only while that tenure is still running.

   Sized for a wide pane. Its circle is measured against the pane's farthest
   corner, so a pane taller than it is wide cuts the ramp mid-fade and lands a
   hard vertical seam instead of a bleed. It simply does not run there. */
export function MonumentLight({
  reach,
  standing,
}: {
  /** 0–1, how far the pool spreads — the reign, on the scale the hall reads. */
  reach: number
  /** A title still held. A closed reign is history, and history is steady. */
  standing: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)

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
    if (!layer || !standing) return
    if (typeof IntersectionObserver === 'undefined') return
    const watch = new IntersectionObserver(([seen]) =>
      layer.classList.toggle('is-offscreen', !seen.isIntersecting),
    )
    watch.observe(layer)
    return () => watch.disconnect()
  }, [standing])

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={`monument-light absolute inset-0 z-0 hidden overflow-hidden rounded-[inherit] md:block${
        standing ? ' monument-light--standing' : ''
      }`}
      style={{ '--monument-reach': reach } as React.CSSProperties}
    >
      <div className="monument-glow" />
    </div>
  )
}
