import type { VehicleCardModel } from '#/og/props/types'
import { CardFrame, Chip } from './primitives'
import { COLOR, GOLOS, SAIRA } from './tokens'

function Kicker({ children }: { children: string }) {
  return (
    <div
      style={{
        display: 'flex',
        fontFamily: GOLOS,
        fontWeight: 500,
        fontSize: 25,
        letterSpacing: 4,
        textTransform: 'uppercase',
        color: COLOR.inkSoft,
      }}
    >
      {children}
    </div>
  )
}

function ArtAside({ art }: { art: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: 560,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingRight: 24,
      }}
    >
      <img
        src={art}
        width={540}
        height={430}
        style={{ objectFit: 'contain' }}
        alt=""
      />
    </div>
  )
}

export function VehicleCard(props: VehicleCardModel & { art?: string | null }) {
  const { art, ...m } = props
  const held = m.kills != null

  return (
    <CardFrame
      nationSlug={m.nationSlug}
      modeLabel={m.modeLabel}
      aside={art ? <ArtAside art={art} /> : undefined}
      contentStyle={{ justifyContent: 'space-between' }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 700 }}>
        <div
          style={{
            display: 'flex',
            fontFamily: SAIRA,
            fontWeight: 700,
            fontSize: 60,
            lineHeight: 1.02,
            letterSpacing: -1,
            color: COLOR.ink,
            maxHeight: 130,
            overflow: 'hidden',
          }}
        >
          {m.vehicleName}
        </div>
        <div
          style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 20 }}
        >
          {m.chips.map((c, i) => (
            <Chip key={i} label={c.label} removed={c.tone === 'removed'} />
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 720 }}>
        {held ? (
          <>
            <Kicker>World record</Kicker>
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                marginTop: 4,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  fontFamily: SAIRA,
                  fontWeight: 800,
                  fontSize: 150,
                  lineHeight: 0.9,
                  letterSpacing: -3,
                  color: COLOR.amber,
                }}
              >
                {m.kills}
              </div>
              <div
                style={{
                  display: 'flex',
                  marginLeft: 18,
                  fontFamily: GOLOS,
                  fontWeight: 500,
                  fontSize: 34,
                  color: COLOR.inkSoft,
                }}
              >
                kills
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                marginTop: 14,
                flexWrap: 'wrap',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  fontFamily: GOLOS,
                  fontWeight: 500,
                  fontSize: 27,
                  color: COLOR.inkSoft,
                  marginRight: 12,
                }}
              >
                held by
              </div>
              <div
                style={{
                  display: 'flex',
                  fontFamily: GOLOS,
                  fontWeight: 600,
                  fontSize: 42,
                  color: COLOR.ink,
                  wordBreak: 'break-word',
                  maxWidth: 640,
                }}
              >
                {m.holder}
              </div>
            </div>
          </>
        ) : (
          <>
            <Kicker>Open bounty</Kicker>
            {m.minKills != null ? (
              <>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    marginTop: 4,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      fontFamily: SAIRA,
                      fontWeight: 800,
                      fontSize: 150,
                      lineHeight: 0.9,
                      letterSpacing: -3,
                      color: COLOR.amber,
                    }}
                  >
                    {m.minKills}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      marginLeft: 18,
                      fontFamily: GOLOS,
                      fontWeight: 500,
                      fontSize: 34,
                      color: COLOR.inkSoft,
                    }}
                  >
                    kills to claim
                  </div>
                </div>
                <div
                  style={{
                    display: 'flex',
                    marginTop: 14,
                    maxWidth: 640,
                    fontFamily: GOLOS,
                    fontWeight: 500,
                    fontSize: 28,
                    lineHeight: 1.3,
                    color: COLOR.inkSoft,
                  }}
                >
                  No verified holder yet — first to {m.minKills} in a single
                  life takes the title.
                </div>
              </>
            ) : (
              <div
                style={{
                  display: 'flex',
                  marginTop: 12,
                  fontFamily: SAIRA,
                  fontWeight: 800,
                  fontSize: 88,
                  letterSpacing: -2,
                  color: COLOR.amber,
                }}
              >
                Unclaimed
              </div>
            )}
          </>
        )}
      </div>
    </CardFrame>
  )
}
