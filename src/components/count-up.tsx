import { useEffect, useState } from 'react'

const DURATION_MS = 800
const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4)

/* SSR and no-JS render the final value; after hydration the number tallies
   up once from zero, scoreboard-style. Tabular numerals keep it shift-free. */
export function CountUp({
  value,
  suffix = '',
}: {
  value: number
  suffix?: string
}) {
  const [shown, setShown] = useState(value)

  useEffect(() => {
    if (value === 0) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let frame = 0
    const start = performance.now()
    const tick = (now: number) => {
      /* Clamped at both ends. A rAF callback is handed the *frame's* start
         time, which can predate the clock read that scheduled it — so an
         unclamped `t` goes a few milliseconds negative, the quartic ease turns
         that into a negative multiplier, and the tally opens on `-6` before it
         opens on `0`. */
      const t = Math.min(Math.max((now - start) / DURATION_MS, 0), 1)
      setShown(Math.round(easeOutQuart(t) * value))
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    setShown(0)
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value])

  return (
    <span>
      {/* Grouped, or a four-figure tenure reads differently here than the
          same number does through formatHeldDays. */}
      {shown.toLocaleString('en-US')}
      {suffix}
    </span>
  )
}
