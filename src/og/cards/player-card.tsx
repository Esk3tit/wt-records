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

export const NAME_SIZE = 66
const NAME_LINE_HEIGHT = 1.04
export const NAME_GAP = 20 // between the name and a country that wrapped below it
const CAPTION_BLOCK = 72 // two lines of "previously known as", plus its margin

const NAME_TWO_LINES = NAME_SIZE * NAME_LINE_HEIGHT * 2

// Rounded up, so two lines always fit whole and a third can never start: slack
// here is what lets a clipped line through as a row of glyph tops.
export const NAME_MAX_HEIGHT = Math.ceil(NAME_TWO_LINES)

/* The tallest identity block the card could already draw, so nothing without a
   country moves. A wrapped country plate fits under this ceiling; the caption
   that would follow it does not, and falls entirely outside rather than part-
   drawn — which is why the ceiling clears the plate but not the caption. */
export const IDENTITY_MAX_HEIGHT = Math.floor(NAME_TWO_LINES) + CAPTION_BLOCK

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
                rowGap: NAME_GAP,
                maxWidth: 600,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  fontFamily: GOLOS,
                  fontWeight: 600,
                  fontSize: NAME_SIZE,
                  lineHeight: NAME_LINE_HEIGHT,
                  letterSpacing: -1,
                  color: COLOR.ink,
                  wordBreak: 'break-word',
                  maxWidth: 600,
                  maxHeight: NAME_MAX_HEIGHT,
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
