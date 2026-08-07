import * as flags from 'country-flag-icons/string/3x2'
import type { PlayerCardModel } from '#/og/props/types'
import {
  CardFrame,
  Chip,
  IdentityDisc,
  RecordCount,
  StatLine,
} from '#/og/cards/primitives'
import { COLOR, GOLOS, SAIRA } from '#/og/cards/tokens'

/* THROWAWAY — profile-v2 prototype (#160). Three placements for the country on
   the 1200×630 player share card. Per ADR 0009 a fetch failing mid-render
   crashes the card, so the flag is inlined at build time, never fetched. */

function countryUri(code: string): string | null {
  const svg = (flags as Record<string, string>)[code]
  if (!svg) return null
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}

function CountryFlag({ code, width }: { code: string; width: number }) {
  const uri = countryUri(code)
  if (!uri) return null
  const h = Math.round((width * 2) / 3)
  return (
    <div
      style={{
        display: 'flex',
        flex: 'none',
        width,
        height: h,
        borderRadius: 4,
        overflow: 'hidden',
        boxShadow: `inset 0 0 0 1px ${COLOR.hairline}`,
      }}
    >
      <img src={uri} width={width} height={h} style={{ objectFit: 'cover' }} alt="" />
    </div>
  )
}

type M = PlayerCardModel & {
  avatar?: string | null
  country?: { code: string; name: string } | null
}

function Name({ m }: { m: M }) {
  return (
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
  )
}

function Former({ m }: { m: M }) {
  if (!m.previouslyKnownAs) return null
  return (
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
  )
}

function Stats({ m, extra }: { m: M; extra?: React.ReactNode }) {
  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: 30, marginTop: 40 }}
    >
      <StatLine label="Best record">
        {m.bestVehicle ? (
          <span style={{ display: 'flex', alignItems: 'baseline', maxWidth: 640 }}>
            <span style={{ display: 'flex', fontWeight: 600, wordBreak: 'break-word' }}>
              {m.bestVehicle}
            </span>
            <span style={{ display: 'flex', color: COLOR.inkFaint, margin: '0 10px' }}>
              ·
            </span>
            <span style={{ display: 'flex', fontFamily: SAIRA, fontWeight: 700 }}>
              {m.bestKills}
            </span>
            <span style={{ display: 'flex', color: COLOR.inkSoft, marginLeft: 8 }}>
              kills
            </span>
          </span>
        ) : (
          <span style={{ display: 'flex', color: COLOR.inkSoft }}>No records yet</span>
        )}
      </StatLine>

      <div style={{ display: 'flex', gap: 56 }}>
        {extra}
        <StatLine label="Nations spanned">
          <span style={{ display: 'flex', fontFamily: SAIRA, fontWeight: 700 }}>
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
                <Chip key={pm.modeLabel} label={`${pm.modeLabel} ${pm.count}`} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Shell({ children, m }: { children: React.ReactNode; m: M }) {
  return (
    <CardFrame contentStyle={{ flexDirection: 'row', alignItems: 'center', gap: 56 }}>
      <div
        style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' }}
      >
        {children}
      </div>
      <RecordCount value={m.totalRecords} caption="current records" />
    </CardFrame>
  )
}

/* S1 — BYLINE. The country is a line under the name, sharing the row with
   "previously known as". Identity reads as one block; nothing else moves. */
export function CardS1(m: M) {
  return (
    <Shell m={m}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
        <IdentityDisc avatar={m.avatar ?? null} name={m.displayName} />
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
          <Name m={m} />
          {(m.country || m.previouslyKnownAs) && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                marginTop: 10,
                fontFamily: GOLOS,
                fontWeight: 500,
                fontSize: 28,
                color: COLOR.inkSoft,
                maxWidth: 600,
              }}
            >
              {m.country && (
                <>
                  <CountryFlag code={m.country.code} width={40} />
                  <span style={{ display: 'flex', color: COLOR.ink }}>
                    {m.country.name}
                  </span>
                </>
              )}
              {m.country && m.previouslyKnownAs && (
                <span style={{ display: 'flex', color: COLOR.inkFaint }}>·</span>
              )}
              {m.previouslyKnownAs && (
                <span style={{ display: 'flex' }}>
                  previously known as {m.previouslyKnownAs}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
      <Stats m={m} />
    </Shell>
  )
}

/* S2 — STAT CELL. The country joins the card's own label/value vocabulary,
   beside "Nations spanned". Flag paired with text by construction. */
export function CardS2(m: M) {
  return (
    <Shell m={m}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
        <IdentityDisc avatar={m.avatar ?? null} name={m.displayName} />
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
          <Name m={m} />
          <Former m={m} />
        </div>
      </div>
      <Stats
        m={m}
        extra={
          m.country ? (
            <StatLine label="Country">
              <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <CountryFlag code={m.country.code} width={40} />
                <span style={{ display: 'flex' }}>{m.country.name}</span>
              </span>
            </StatLine>
          ) : undefined
        }
      />
    </Shell>
  )
}

/* S3 — NAMEPLATE. The country rides on the name's own line as a trailing
   lockup, so a scanner reads "who, and from where" in one movement. */
export function CardS3(m: M) {
  return (
    <Shell m={m}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
        <IdentityDisc avatar={m.avatar ?? null} name={m.displayName} />
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
            <Name m={m} />
            {m.country && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '8px 18px 8px 12px',
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.07)',
                  boxShadow: `inset 0 0 0 1px ${COLOR.hairlineSoft}`,
                }}
              >
                <CountryFlag code={m.country.code} width={36} />
                <span
                  style={{
                    display: 'flex',
                    fontFamily: GOLOS,
                    fontWeight: 500,
                    fontSize: 28,
                    color: COLOR.ink,
                  }}
                >
                  {m.country.name}
                </span>
              </div>
            )}
          </div>
          <Former m={m} />
        </div>
      </div>
      <Stats m={m} />
    </Shell>
  )
}
