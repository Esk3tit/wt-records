import { useEffect, useRef, useState } from 'react'

interface Ember {
  left: string
  duration: string
  delay: string
  opacity: number
}

/* The Spatial Scene slot: layered CSS placeholder until the depth-processed
   imagery lands. Layer contract is already final: scene → scrim → glass. */
export function SceneBackdrop() {
  const sceneRef = useRef<HTMLDivElement>(null)
  // Embers are generated client-side only: Math.random during SSR would
  // hydrate against different values.
  const [embers, setEmbers] = useState<Array<Ember>>([])

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    setEmbers(
      Array.from({ length: 14 }, () => ({
        left: `${Math.random() * 100}%`,
        duration: `${7 + Math.random() * 9}s`,
        delay: `${-Math.random() * 12}s`,
        opacity: 0.3 + Math.random() * 0.5,
      })),
    )

    const scene = sceneRef.current
    if (!scene) return
    const layers = Array.from(
      scene.querySelectorAll<HTMLElement>('[data-depth]'),
    )
    let mx = 0
    let my = 0
    let sy = 0
    let frame = 0
    const apply = () => {
      frame = 0
      for (const layer of layers) {
        const depth = Number(layer.dataset.depth)
        layer.style.transform = `translate3d(${mx * depth * 40}px, ${my * depth * 40 + sy * depth}px, 0)`
      }
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(apply)
    }
    const onPointer = (e: PointerEvent) => {
      mx = (e.clientX / window.innerWidth - 0.5) * 2
      my = (e.clientY / window.innerHeight - 0.5) * 2
      schedule()
    }
    const onScroll = () => {
      sy = window.scrollY
      schedule()
    }
    window.addEventListener('pointermove', onPointer, { passive: true })
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('pointermove', onPointer)
      window.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <>
      <div ref={sceneRef} className="scene" aria-hidden="true">
        <div className="scene-sky" />
        <div className="scene-glow" data-depth="0.10" />
        <div className="scene-glow-cool" data-depth="0.06" />
        <div className="scene-haze" />
        <svg
          className="scene-ridge"
          style={{ bottom: '18%', opacity: 0.5 }}
          data-depth="0.04"
          viewBox="0 0 1200 200"
          preserveAspectRatio="none"
        >
          <path
            d="M0 200 L0 120 Q150 70 320 100 T640 90 T960 110 T1200 95 L1200 200Z"
            fill="var(--ridge-far)"
          />
        </svg>
        <svg
          className="scene-ridge"
          style={{ bottom: '8%', opacity: 0.7 }}
          data-depth="0.08"
          viewBox="0 0 1200 200"
          preserveAspectRatio="none"
        >
          <path
            d="M0 200 L0 140 Q200 95 420 130 T820 120 T1200 130 L1200 200Z"
            fill="var(--ridge-mid)"
          />
        </svg>
        <svg
          className="scene-ridge"
          style={{ bottom: '-2%', opacity: 0.95 }}
          data-depth="0.16"
          viewBox="0 0 1200 220"
          preserveAspectRatio="none"
        >
          <path
            d="M0 220 L0 150 Q260 110 520 145 Q760 175 1000 140 Q1120 125 1200 150 L1200 220Z"
            fill="var(--ridge-near)"
          />
        </svg>
        {embers.map((e, i) => (
          <div
            key={i}
            className="scene-ember"
            style={{
              left: e.left,
              bottom: 0,
              animationDuration: e.duration,
              animationDelay: e.delay,
              opacity: e.opacity,
            }}
          />
        ))}
      </div>
      <div className="scene-scrim" aria-hidden="true" />
      <div className="scene-grain" aria-hidden="true" />
    </>
  )
}
