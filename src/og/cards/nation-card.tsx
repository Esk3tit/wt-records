import type { NationCardModel } from '#/og/props/types'
import { CardFrame, CompletionRing, FlagChip, StatLine } from './primitives'
import { COLOR, GOLOS, SAIRA } from './tokens'

export function NationCard(m: NationCardModel) {
  return (
    <CardFrame
      nationSlug={m.nationSlug}
      modeLabel={m.modeLabel}
      contentStyle={{ flexDirection: 'row', alignItems: 'center', gap: 48 }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          justifyContent: 'center',
          gap: 34,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <FlagChip slug={m.nationSlug} size={72} />
          <div
            style={{
              display: 'flex',
              fontFamily: SAIRA,
              fontWeight: 700,
              fontSize: 60,
              letterSpacing: -1,
              color: COLOR.ink,
              maxWidth: 540,
              maxHeight: 130,
              overflow: 'hidden',
            }}
          >
            {m.nationName}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 56 }}>
          <StatLine label="Titles held">
            <span
              style={{ display: 'flex', fontFamily: SAIRA, fontWeight: 700 }}
            >
              {m.held}
            </span>
            <span
              style={{
                display: 'flex',
                color: COLOR.inkFaint,
                margin: '0 8px',
              }}
            >
              of
            </span>
            <span
              style={{ display: 'flex', fontFamily: SAIRA, fontWeight: 700 }}
            >
              {m.total}
            </span>
          </StatLine>
          <StatLine label="Avg kills">
            <span
              style={{ display: 'flex', fontFamily: SAIRA, fontWeight: 700 }}
            >
              {m.avgKills != null ? m.avgKills.toFixed(1) : '—'}
            </span>
          </StatLine>
        </div>

        <StatLine label="Most held">
          <span
            style={{
              display: 'flex',
              fontFamily: GOLOS,
              fontWeight: 600,
              wordBreak: 'break-word',
              maxWidth: 620,
            }}
          >
            {m.mostHeldPlayer ?? '—'}
          </span>
        </StatLine>
      </div>

      <CompletionRing pct={m.completionPct} />
    </CardFrame>
  )
}
