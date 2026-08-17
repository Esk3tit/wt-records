import type { PlayerCardModel } from '#/og/props/types'
import {
  CardFrame,
  Chip,
  CountryPlate,
  IdentityDisc,
  RecordCount,
  StatLine,
} from './primitives'
import { COLOR, GOLOS, SAIRA } from './tokens'

const NAME_MAX_HEIGHT = 150 // two lines of the display name
const CAPTION_MAX_HEIGHT = 59 // two lines of "previously known as", plus its margin

// The tallest identity block the card could already draw, so nothing without a
// country moves and only a country can reach the ceiling.
const IDENTITY_MAX_HEIGHT = NAME_MAX_HEIGHT + CAPTION_MAX_HEIGHT

export function PlayerCard(m: PlayerCardModel & { avatar?: string | null }) {
  return (
    <CardFrame
      contentStyle={{ flexDirection: 'row', alignItems: 'center', gap: 56 }}
    >
      {/* Stretched so the column has a height to lay out against: sized to its
          content instead, an overlong identity block grows past the card. */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          alignSelf: 'stretch',
          justifyContent: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <IdentityDisc avatar={m.avatar ?? null} name={m.displayName} />
          {/* The frame is fixed, so this column is what yields: a name already
              on two lines has no room left for a country AND a former name, and
              the caption is what goes — never the record or the hero below. */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              minWidth: 0,
              flex: 1,
              maxHeight: IDENTITY_MAX_HEIGHT,
              overflow: 'hidden',
            }}
          >
            {/* The country takes the name's line, never the caption's: sharing
                with "previously known as" is what left the flag off baseline. */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                columnGap: 20,
                rowGap: 20,
                maxWidth: 600,
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
              {m.countryCode && <CountryPlate code={m.countryCode} />}
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
            flex: 'none',
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
