import { ArrowUpRight } from 'lucide-react'
import type { RenderedLink } from '#/links/render'
import { linkAccessibleName } from '#/links/render'

/* The rail of Profile links. A deliberate, recorded exception to the hall's
   chroma-neutral identity — see `#/links/platforms` for why the plate is white
   and opaque, and why one platform ships as a wordmark.

   The handle stays visible. It is the whole anti-impersonation signal, and
   hover is not a mitigation on a phone: a row of glyphs says which platforms,
   only the handle says whose. */

/** The mark's own width, and therefore — read as distance to other elements,
    which is the standard reading — the plate→handle gap and the link→link gap
    that X, Kick and Bluesky each require. This is what sets the rail's width.
    Read as plate padding instead, it would make every plate 3× the mark. */
const CLEAR_SPACE = 'gap-6'

const PLATE =
  'inline-flex h-8 shrink-0 items-center justify-center rounded-[7px] bg-white ring-1 ring-black/10'

export function ProfileLinks({
  links,
}: {
  links: ReadonlyArray<RenderedLink>
}) {
  if (links.length === 0) return null
  return (
    <ul
      data-profile-links
      className={`mt-4 flex flex-wrap items-center ${CLEAR_SPACE}`}
    >
      {links.map((link) => (
        <li key={link.platform}>
          <ProfileLink link={link} />
        </li>
      ))}
    </ul>
  )
}

function ProfileLink({ link }: { link: RenderedLink }) {
  return (
    <a
      href={link.url}
      target="_blank"
      /* `me` is machine-readable for "this profile claims that one", which is
         precisely true. `ugc nofollow` is what stops a profile system being
         worth farming — two university MediaWikis were colonised into War
         Thunder Golden Eagles spam farms on this exact keyword space. And
         `noopener` stays written even though target="_blank" implies it: these
         readers click from Steam's in-client CEF browser and Discord's embedded
         webview, which lag desktop Chrome. */
      rel="me ugc nofollow noopener"
      /* The repo's `noreferrer` default is wrong here — it strips the referrer,
         so a creator gets no attribution for the traffic we send them, which is
         the entire social contract. `origin` sends wtrecords.gg without saying
         which player's page it came from. */
      referrerPolicy="origin"
      aria-label={linkAccessibleName(link)}
      className={`tap-reach group inline-flex items-center ${CLEAR_SPACE}`}
    >
      <BrandPlate link={link} />
      <span className="inline-flex min-w-0 items-center gap-1 text-sm text-fg-muted transition-colors duration-200 group-hover:text-fg">
        <span className="truncate">{link.display}</span>
        <ArrowUpRight size={14} className="shrink-0" aria-hidden />
      </span>
    </a>
  )
}

function BrandPlate({ link }: { link: RenderedLink }) {
  if (link.wordmark) {
    // A pill sized to the word, not the square glyph plate: the row aligns on
    // plate height and never plate width. Set in our own type, never the
    // platform's, and never as a lockup with our own mark.
    return (
      <span
        className={`${PLATE} px-2.5 text-[13px] font-semibold text-[#3f3f46]`}
      >
        {link.wordmark}
      </span>
    )
  }
  if (!link.mark) {
    // The personal site: no brand, so no brand mark — a neutral glyph in the
    // same plate, which is what keeps the row aligned.
    return (
      <span className={`${PLATE} w-8`}>
        <ArrowUpRight size={18} className="text-[#3f3f46]" aria-hidden />
      </span>
    )
  }
  return (
    <span className={`${PLATE} w-8`}>
      <svg
        viewBox="0 0 24 24"
        width={24}
        height={24}
        // The accessible name already says the platform; a glyph that named
        // itself again would say it twice.
        aria-hidden="true"
        focusable="false"
      >
        <path d={link.mark.path} fill={link.mark.hex} />
      </svg>
    </span>
  )
}
