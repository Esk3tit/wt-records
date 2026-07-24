import type { PlayerCardModel } from '#/og/props/types'
import {
  CardFrame,
  Chip,
  IdentityDisc,
  RecordCount,
  StatLine,
} from './primitives'
import { COLOR, GOLOS, SAIRA } from './tokens'

export function PlayerCard(m: PlayerCardModel & { avatar?: string | null }) {
  return (
    <CardFrame
      contentStyle={{ flexDirection: 'row', alignItems: 'center', gap: 56 }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          justifyContent: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <IdentityDisc avatar={m.avatar ?? null} name={m.displayName} />
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              minWidth: 0,
              flex: 1,
            }}
          >
            <div
              style={{
                display: 'flex',
                fontFamily: GOLOS,
                fontWeight: 600,
                fontSize: 66,
                lineHeight: 1.04,
                letterSpacing: -1,
                color: COLOR.ink,
                wordBreak: 'break-word',
                maxWidth: 600,
                maxHeight: 150,
                overflow: 'hidden',
              }}
            >
              {m.displayName}
            </div>
            {m.previouslyKnownAs && (
              <div
                style={{
                  display: 'flex',
                  marginTop: 8,
                  fontFamily: GOLOS,
                  fontWeight: 500,
                  fontSize: 26,
                  color: COLOR.inkSoft,
                  maxWidth: 600,
                }}
              >
                previously known as {m.previouslyKnownAs}
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 30,
            marginTop: 40,
          }}
        >
          <StatLine label="Best record">
            {m.bestVehicle ? (
              <span
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  maxWidth: 640,
                }}
              >
                <span
                  style={{
                    display: 'flex',
                    fontWeight: 600,
                    wordBreak: 'break-word',
                  }}
                >
                  {m.bestVehicle}
                </span>
                <span
                  style={{
                    display: 'flex',
                    color: COLOR.inkFaint,
                    margin: '0 10px',
                  }}
                >
                  ·
                </span>
                <span
                  style={{
                    display: 'flex',
                    fontFamily: SAIRA,
                    fontWeight: 700,
                  }}
                >
                  {m.bestKills}
                </span>
                <span
                  style={{
                    display: 'flex',
                    color: COLOR.inkSoft,
                    marginLeft: 8,
                  }}
                >
                  kills
                </span>
              </span>
            ) : (
              <span style={{ display: 'flex', color: COLOR.inkSoft }}>
                No records yet
              </span>
            )}
          </StatLine>

          <div style={{ display: 'flex', gap: 56 }}>
            <StatLine label="Nations spanned">
              <span
                style={{ display: 'flex', fontFamily: SAIRA, fontWeight: 700 }}
              >
                {m.nationsSpanned}
              </span>
            </StatLine>
            {m.perMode.length > 0 && (
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
                  By mode
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                  {m.perMode.map((pm) => (
                    <Chip
                      key={pm.modeLabel}
                      label={`${pm.modeLabel} ${pm.count}`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <RecordCount value={m.totalRecords} caption="current records" />
    </CardFrame>
  )
}
