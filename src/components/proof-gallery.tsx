import { Chip } from '#/components/chip'
import { SectionHead } from '#/components/section-head'

export interface ProofItem {
  id: number
  kind: string
  url: string | null
  storagePath: string | null
}

const KINDS: Record<string, { label: string; title: string }> = {
  scoreboard: {
    label: 'Scoreboard',
    title: 'The match scoreboard, showing the kill count',
  },
  end_game: {
    label: 'End of game',
    title: "The end-of-game screen from the record's match",
  },
  end_life: {
    label: 'End of life',
    title: 'The end-of-life screen closing the run',
  },
  video: { label: 'Video', title: 'Video of the run' },
}

// A kind the catalogue grows before this map does still names itself.
const kindOf = (kind: string) =>
  KINDS[kind] ?? { label: kind, title: 'Verification proof' }

function proofHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'external link'
  }
}

/* The evidence wall. Proof that exists but can't be reached from here is still
   shown — a title's evidence is never silently missing. */
export function ProofGallery({
  proofs,
  archived,
}: {
  proofs: Array<ProofItem>
  /** Verified records mirror their proof at verification; migrated ones
      inherit whatever the record book had. */
  archived: boolean
}) {
  if (proofs.length === 0) return null
  const images = proofs.filter((p) => p.storagePath && p.url)
  const links = proofs.filter((p) => !(p.storagePath && p.url) && p.url)
  const unreachable = proofs.filter((p) => !p.url)

  return (
    <section className="mt-8">
      <SectionHead
        title="Proof"
        aside={archived ? 'archived at verification' : undefined}
      />
      <div className="flex flex-wrap items-start gap-x-3.5 gap-y-4">
        {images.map((p) => (
          <figure key={p.id} className="m-0">
            <a
              href={p.url!}
              target="_blank"
              rel="noreferrer"
              className="proof-thumb"
            >
              <img
                src={p.url!}
                alt={`${kindOf(p.kind).label} screenshot — verification proof`}
                loading="lazy"
              />
            </a>
            <figcaption className="mt-2">
              <Chip title={kindOf(p.kind).title}>{kindOf(p.kind).label}</Chip>
            </figcaption>
          </figure>
        ))}
        {links.map((p) => (
          <a
            key={p.id}
            href={p.url!}
            target="_blank"
            rel="noreferrer"
            className="glass-thin inline-flex items-center gap-1.5 rounded-[10px] px-3.5 py-2 text-[0.8125rem] font-medium text-fg-muted no-underline transition-colors duration-200 hover:text-fg"
          >
            {kindOf(p.kind).label}
            <span className="text-fg-faint">· {proofHost(p.url!)} ↗</span>
          </a>
        ))}
        {unreachable.map((p) => (
          <span
            key={p.id}
            className="glass-thin inline-flex items-center gap-1.5 rounded-[10px] px-3.5 py-2 text-[0.8125rem] font-medium text-fg-faint"
            title="Held in the archive, with no public address to serve it from"
          >
            {kindOf(p.kind).label}
            <span>· archived</span>
          </span>
        ))}
      </div>
    </section>
  )
}
