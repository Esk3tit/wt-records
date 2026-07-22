import { SITE_DESCRIPTION } from '#/og/copy'
import { CardFrame } from './primitives'
import { COLOR, GOLOS, SAIRA } from './tokens'

/* The one card every non-dynamic page unfurls with — and the committed static
   fallback served when a render fails. Same glass + scene treatment; wordmark as
   the brand moment (typography-only per the branding-pending rule). */
export function SiteCard() {
  return (
    <CardFrame
      contentStyle={{ alignItems: 'center', justifyContent: 'center' }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          fontFamily: SAIRA,
          fontWeight: 700,
          fontSize: 108,
          letterSpacing: 2,
          color: COLOR.ink,
        }}
      >
        <span style={{ display: 'flex' }}>WT</span>
        <span style={{ display: 'flex', color: COLOR.amber, margin: '0 20px' }}>
          ·
        </span>
        <span style={{ display: 'flex' }}>RECORDS</span>
      </div>
      <div
        style={{
          display: 'flex',
          marginTop: 28,
          maxWidth: 840,
          textAlign: 'center',
          fontFamily: GOLOS,
          fontWeight: 500,
          fontSize: 30,
          lineHeight: 1.4,
          color: COLOR.inkSoft,
        }}
      >
        {SITE_DESCRIPTION}
      </div>
    </CardFrame>
  )
}
