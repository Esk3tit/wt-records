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
      const t = Math.min((now - start) / DURATION_MS, 1)
      setShown(Math.round(easeOutQuart(t) * value))
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    setShown(0)
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value])

  return (
    <span>
      {shown}
      {suffix}
    </span>
  )
}
