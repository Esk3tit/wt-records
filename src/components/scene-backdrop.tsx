import { useEffect, useRef, useState } from 'react'

interface Ember {
  left: string
  duration: string
  delay: string
  opacity: number
}

export type SceneVariant = 'hall' | 'hangar'

/* The Spatial Scene slot: layered CSS placeholder until the depth-processed
   imagery lands. Layer contract is already final: scene → scrim → glass. */
export function SceneBackdrop({
  variant = 'hall',
}: {
  variant?: SceneVariant
}) {
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
  }, [])

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

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
    // The layer list is queried once per scene, so a variant swap re-collects.
  }, [variant])

  return (
    <>
      <div ref={sceneRef} className="scene" aria-hidden="true">
        <div className="scene-sky" />
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
        {variant === 'hall' ? (
          <>
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
          </>
        ) : (
          <>
            <svg
              className="scene-ridge"
              style={{ bottom: '7%', opacity: 0.7 }}
              data-depth="0.08"
              viewBox="0 0 1200 200"
              preserveAspectRatio="none"
            >
              <path
                d="M0 200 L0 138 Q260 128 560 133 T1200 130 L1200 200Z"
                fill="var(--ridge-mid)"
              />
            </svg>
            <svg
              className="scene-ridge"
              style={{ bottom: '-2%', opacity: 0.95 }}
              data-depth="0.16"
              viewBox="0 0 1200 200"
              preserveAspectRatio="none"
            >
              <path
                d="M0 200 L0 130 Q300 122 620 126 T1200 124 L1200 200Z"
                fill="var(--ridge-near)"
              />
              <g fill="var(--ridge-far)" opacity="0.7">
                <rect x="180" y="168" width="70" height="4" />
                <rect x="420" y="166" width="70" height="4" />
                <rect x="660" y="165" width="70" height="4" />
                <rect x="900" y="166" width="70" height="4" />
              </g>
            </svg>
            {/* Hangar paints after the apron, and overflow stays visible, so
                the doorway glow can spill past the viewBox onto the tarmac. */}
            <svg
              style={{
                position: 'absolute',
                left: '5%',
                bottom: '11%',
                width: 'clamp(17rem, 40vw, 34rem)',
                opacity: 0.95,
                overflow: 'visible',
              }}
              data-depth="0.18"
              viewBox="0 0 320 170"
            >
              <defs>
                <radialGradient id="hangar-doorglow" cx="50%" cy="85%" r="70%">
                  {/* stop-color only resolves var() as a CSS property, not
                      as a presentation attribute. */}
                  <stop
                    offset="0%"
                    style={{ stopColor: 'var(--hangar-glow)' }}
                  />
                  <stop
                    offset="55%"
                    style={{ stopColor: 'var(--hangar-glow)' }}
                    stopOpacity="0.45"
                  />
                  <stop
                    offset="100%"
                    style={{ stopColor: 'var(--hangar-glow)' }}
                    stopOpacity="0"
                  />
                </radialGradient>
              </defs>
              <ellipse
                cx="160"
                cy="128"
                rx="150"
                ry="80"
                fill="url(#hangar-doorglow)"
              />
              <path
                d="M6 166 L6 144 Q6 30 160 30 Q314 30 314 144 L314 166 Z"
                fill="var(--ridge-far)"
              />
              <path
                fillRule="evenodd"
                d="M6 170 L6 148 Q6 34 160 34 Q314 34 314 148 L314 170 Z
                   M46 170 L46 146 Q46 66 160 66 Q274 66 274 146 L274 170 Z"
                fill="var(--ridge-near)"
              />
              <path
                d="M26 170 L26 147 Q26 50 160 50 Q294 50 294 147 L294 170"
                fill="none"
                stroke="var(--ridge-mid)"
                strokeWidth="2.5"
              />
              <ellipse
                cx="160"
                cy="176"
                rx="150"
                ry="18"
                fill="url(#hangar-doorglow)"
                opacity="0.6"
              />
            </svg>
            {/* Windsock */}
            <svg
              style={{
                position: 'absolute',
                right: '12%',
                bottom: '11%',
                width: 'clamp(4rem, 6.5vw, 6rem)',
                opacity: 0.9,
              }}
              data-depth="0.15"
              viewBox="0 0 60 130"
            >
              <path
                d="M27 130 L27 10 L31 10 L31 130 Z"
                fill="var(--ridge-far)"
              />
              <path
                d="M31 12 Q56 22 54 48 Q52 66 41 68 Q34 48 31 22 Z"
                fill="var(--ridge-far)"
              />
            </svg>
          </>
        )}
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
