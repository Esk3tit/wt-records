import type { CSSProperties, ReactNode } from 'react'
import { CARD_HEIGHT, CARD_WIDTH } from '#/og/render/renderer'
import { flagDataUri } from './flag-image'
import {
  AMBER_GLOW,
  COLOR,
  GOLOS,
  RADIUS,
  SAIRA,
  SCENE_GRADIENT,
  glassChip,
  glassPanel,
} from './tokens'

// Static stand-in for the site's WebGL Spatial Scene: a Night Hangar depth
// gradient, the amber Record-Monument glow behind the hero, and a faint nation
// flag washing off one edge so the room still swaps per nation.
function Scene({ nationSlug }: { nationSlug?: string }) {
  const flag = nationSlug ? flagDataUri(nationSlug) : null
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        background: SCENE_GRADIENT,
      }}
    >
      {flag && (
        <div
          style={{
            position: 'absolute',
            right: -120,
            top: -80,
            width: 760,
            height: 760,
            display: 'flex',
            opacity: 0.06,
          }}
        >
          <img
            src={flag}
            width={760}
            height={760}
            style={{ objectFit: 'cover' }}
            alt=""
          />
        </div>
      )}
      <div
        style={{
          position: 'absolute',
          left: -80,
          bottom: -220,
          width: 760,
          height: 620,
          display: 'flex',
          background: AMBER_GLOW,
        }}
      />
    </div>
  )
}

export function Wordmark({ muted = false }: { muted?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        fontFamily: SAIRA,
        fontWeight: 700,
        fontSize: 26,
        letterSpacing: 3,
        color: muted ? COLOR.inkFaint : COLOR.inkSoft,
      }}
    >
      <span style={{ display: 'flex' }}>WT</span>
      <span style={{ display: 'flex', color: COLOR.amber, margin: '0 6px' }}>
        ·
      </span>
      <span style={{ display: 'flex' }}>RECORDS</span>
    </div>
  )
}

export function ModeBadge({ label }: { label: string }) {
  // Neutral ink, never amber — the One Amber Rule reserves amber for the hero.
  return (
    <div
      style={{
        alignItems: 'center',
        height: 40,
        padding: '0 16px',
        ...glassChip,
        borderRadius: RADIUS.pill,
        fontFamily: SAIRA,
        fontWeight: 600,
        fontSize: 26,
        letterSpacing: 2,
        color: COLOR.inkSoft,
      }}
    >
      {label}
    </div>
  )
}

// Chip labels are informational, so all — including "removed" — stay ≥0.7 alpha
// ink; the word itself flags a Removed vehicle (no low-alpha ink needed).
export function Chip({ label }: { label: string }) {
  return (
    <div
      style={{
        alignItems: 'center',
        flex: 'none',
        height: 44,
        padding: '0 16px',
        ...glassChip,
        fontFamily: GOLOS,
        fontWeight: 500,
        fontSize: 27,
        color: COLOR.inkSoft,
      }}
    >
      {label}
    </div>
  )
}

/** A crisp nation flag, hairline-bound like the site's flag chip. */
export function FlagChip({ slug, size = 60 }: { slug: string; size?: number }) {
  const flag = flagDataUri(slug)
  if (!flag) return null
  const h = Math.round((size * 68) / 100)
  return (
    <div
      style={{
        display: 'flex',
        flex: 'none',
        width: size,
        height: h,
        borderRadius: 6,
        overflow: 'hidden',
        boxShadow: `inset 0 0 0 1px ${COLOR.hairline}`,
      }}
    >
      <img
        src={flag}
        width={size}
        height={h}
        style={{ objectFit: 'cover' }}
        alt=""
      />
    </div>
  )
}

// The nation card's single amber anchor: an amber conic sweep over a neutral
// track (no SVG arc math), with the percentage in the recessed well.
export function CompletionRing({ pct }: { pct: number }) {
  const deg = Math.round((Math.min(100, Math.max(0, pct)) / 100) * 360)
  const size = 300
  const well = 224
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: RADIUS.pill,
        background: `conic-gradient(${COLOR.amber} 0deg ${deg}deg, ${COLOR.ringTrack} ${deg}deg 360deg)`,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: well,
          height: well,
          borderRadius: RADIUS.pill,
          background: COLOR.well,
          boxShadow: `inset 0 0 0 1px ${COLOR.hairline}`,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            fontFamily: SAIRA,
            fontWeight: 800,
            fontSize: 96,
            lineHeight: 1,
            color: COLOR.ink,
          }}
        >
          {pct}
          <span
            style={{
              display: 'flex',
              fontSize: 40,
              fontWeight: 700,
              marginLeft: 4,
              color: COLOR.inkSoft,
            }}
          >
            %
          </span>
        </div>
        <div
          style={{
            display: 'flex',
            marginTop: 6,
            fontFamily: GOLOS,
            fontWeight: 500,
            fontSize: 26,
            letterSpacing: 1,
            color: COLOR.inkSoft,
          }}
        >
          complete
        </div>
      </div>
    </div>
  )
}

// The player card's framed record count — a neutral ring frame so the amber
// number never floats unanchored (the critique's fix). Number amber, frame not.
export function Medallion({
  value,
  caption,
}: {
  value: number
  caption: string
}) {
  const size = 260
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 'none',
        width: size,
        height: size,
        borderRadius: RADIUS.pill,
        background: COLOR.frostFaint,
        boxShadow: `inset 0 0 0 2px ${COLOR.hairline}, inset 0 0 0 12px ${COLOR.frostFainter}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          fontFamily: SAIRA,
          fontWeight: 800,
          fontSize: 120,
          lineHeight: 1,
          color: COLOR.amber,
        }}
      >
        {value}
      </div>
      <div
        style={{
          display: 'flex',
          marginTop: 8,
          fontFamily: GOLOS,
          fontWeight: 500,
          fontSize: 26,
          letterSpacing: 1,
          color: COLOR.inkSoft,
        }}
      >
        {caption}
      </div>
    </div>
  )
}

/** Label over value — the stat register used by the nation and player cards. */
export function StatLine({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          display: 'flex',
          fontFamily: GOLOS,
          fontWeight: 500,
          fontSize: 26,
          letterSpacing: 2,
          textTransform: 'uppercase',
          color: COLOR.inkSoft,
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          marginTop: 4,
          fontFamily: GOLOS,
          fontWeight: 500,
          fontSize: 32,
          color: COLOR.ink,
        }}
      >
        {children}
      </div>
    </div>
  )
}

/* ── CardFrame: scene + one glass pane, wordmark and mode badge on the glass ──
   One glass layer, then content (never a card-in-card). `aside` rides on the
   scene to the pane's right — the slot the vehicle art bleeds into. */
export function CardFrame({
  nationSlug,
  modeLabel,
  aside,
  children,
  contentStyle,
}: {
  nationSlug?: string
  modeLabel?: string
  aside?: ReactNode
  children: ReactNode
  contentStyle?: CSSProperties
}) {
  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        background: COLOR.night,
      }}
    >
      <Scene nationSlug={nationSlug} />
      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          margin: 28,
          padding: 48,
          width: CARD_WIDTH - 56,
          height: CARD_HEIGHT - 56,
          ...glassPanel,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Wordmark />
          {modeLabel ? <ModeBadge label={modeLabel} /> : <div />}
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            ...contentStyle,
          }}
        >
          {children}
        </div>
      </div>
      {/* Rides in front of the glass — the vehicle art emerging from the pane. */}
      {aside}
    </div>
  )
}
