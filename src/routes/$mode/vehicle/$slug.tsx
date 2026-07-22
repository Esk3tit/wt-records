import { Link, createFileRoute, notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { NationFlag } from '#/components/nation-flag'
import { RecordHistory } from '#/components/record-history'
import { RecordName } from '#/components/record-name'
import { SectionHead } from '#/components/section-head'
import { VehicleTags } from '#/components/vehicle-tags'
import { db } from '#/db'
import { getVehicle } from '#/db/queries'
import { daysSince, formatDayYear } from '#/lib/dates'
import { formatBr } from '#/lib/format'
import { toVehicleCardModel } from '#/og/props/vehicle'
import { vehicleUnfurl } from '#/og/copy'
import { vehicleCardUrl } from '#/og/urls'
import { cardMeta } from '#/og/meta'

const loadVehicle = createServerFn({ method: 'GET' })
  .validator((data: { mode: string; slug: string }) => data)
  .handler(async ({ data }) => {
    const vehicle = await getVehicle(db, data.mode, data.slug)
    if (!vehicle) throw notFound()
    return vehicle
  })

export const Route = createFileRoute('/$mode/vehicle/$slug')({
  loader: ({ params, context }) =>
    context.mode.isLive
      ? loadVehicle({ data: { mode: params.mode, slug: params.slug } })
      : null,
  // Coming-soon mode → loaderData null → keep the site card (root defaults).
  head: ({ loaderData, params }) => {
    if (!loaderData) return {}
    const model = toVehicleCardModel(params.mode, loaderData)
    const { title, description } = vehicleUnfurl(model)
    return {
      meta: cardMeta({
        title,
        description,
        image: vehicleCardUrl(params.mode, params.slug, model.version),
      }),
    }
  },
  component: VehicleDetail,
})

const PROOF_KIND_LABEL: Record<string, string> = {
  scoreboard: 'Scoreboard',
  end_game: 'End of game',
  end_life: 'End of life',
  video: 'Video',
}

function heldLine(verifiedAt: Date | string): string {
  const days = daysSince(verifiedAt)
  if (days === 0) return `Set today · ${formatDayYear(verifiedAt)}`
  return `Held ${days} ${days === 1 ? 'day' : 'days'} · since ${formatDayYear(verifiedAt)}`
}

function proofHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'external link'
  }
}

function VehicleDetail() {
  const { mode } = Route.useParams()
  const data = Route.useLoaderData()
  if (!data) return null
  const { vehicle, br, current, proofs, history, titleSteps, minKills } = data

  const imageProofs = proofs.filter((p) => p.storagePath && p.url)
  const linkProofs = proofs.filter((p) => !(p.storagePath && p.url) && p.url)
  // storagePath without a configured public base URL and no original link —
  // the proof exists and must still be visible, just not reachable from here
  const unreachableProofs = proofs.filter((p) => !p.url)

  return (
    <section className="py-6">
      {/* ── The title pane: identity left, the machine itself right. ── */}
      <div className="glass-thick relative overflow-hidden p-7 md:p-9">
        <NationFlag slug={vehicle.nationSlug} variant="wash" />
        <div className="relative z-[1] flex flex-col-reverse items-start gap-x-10 gap-y-6 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-x-2 text-[0.8125rem] text-fg-muted">
              <NationFlag slug={vehicle.nationSlug} />
              <Link
                to="/$mode/nation/$slug"
                params={{ mode, slug: vehicle.nationSlug }}
                className="text-fg-muted no-underline hover:text-fg hover:underline"
              >
                {vehicle.nationName}
              </Link>
              <span aria-hidden="true">·</span>
              <span className="capitalize">{vehicle.class}</span>
              {vehicle.rank != null && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>rank {vehicle.rank}</span>
                </>
              )}
              {br != null && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>BR {formatBr(br)}</span>
                </>
              )}
            </p>
            <h1 className="mt-1.5 text-3xl font-bold tracking-[-0.02em] text-balance md:text-4xl">
              {vehicle.name}
              <VehicleTags tags={vehicle} />
            </h1>

            {current ? (
              <div className="mt-7">
                <p className="text-[0.6875rem] font-semibold tracking-[0.12em] text-fg-muted uppercase">
                  World record
                </p>
                <p className="mt-1 text-6xl leading-none font-bold tracking-[-0.03em] text-accent-text md:text-7xl">
                  {current.kills}
                  <span className="ml-2 text-[0.9375rem] font-medium tracking-[0.06em] text-fg-muted">
                    kills
                  </span>
                </p>
                <p className="mt-3 text-[1.0625rem] font-semibold">
                  <RecordName
                    displayName={current.displayName}
                    playerSlug={current.playerSlug}
                    ignSnapshot={current.ignSnapshot}
                    displayNameSnapshot={current.displayNameSnapshot}
                  />
                </p>
                <p className="mt-1 text-[0.8125rem] text-fg-muted">
                  {current.verifiedAt
                    ? heldLine(current.verifiedAt)
                    : 'Migrated from the community record book'}
                </p>
                <p className="mt-0.5 text-[0.8125rem] text-fg-faint">
                  Patch {current.patch}
                  {current.patchName ? ` · ${current.patchName}` : ''}
                  {current.runBr != null
                    ? ` · run BR ${formatBr(current.runBr)}`
                    : ''}
                </p>
              </div>
            ) : (
              <div className="mt-7">
                <p className="text-[0.6875rem] font-semibold tracking-[0.12em] text-fg-muted uppercase">
                  Open bounty
                </p>
                {minKills != null ? (
                  <>
                    <p className="mt-1 text-6xl leading-none font-bold tracking-[-0.03em] text-fg md:text-7xl">
                      {minKills}
                      <span className="ml-2 text-[0.9375rem] font-medium tracking-[0.06em] text-fg-muted">
                        kills to claim
                      </span>
                    </p>
                    <p className="mt-3 max-w-[34ch] text-[0.9375rem] text-fg-muted">
                      No verified holder yet — {minKills}
                      {vehicle.isDifficult
                        ? ' kills (Difficult-class bar)'
                        : ` kills (${vehicle.class} bar)`}{' '}
                      in one life takes this title first.
                    </p>
                  </>
                ) : (
                  <p className="mt-2 max-w-[34ch] text-[0.9375rem] text-fg-muted">
                    No verified holder yet — this title is waiting for its first
                    claim.
                  </p>
                )}
              </div>
            )}
          </div>

          {vehicle.image && (
            <img
              src={vehicle.image}
              alt=""
              className="vehicle-portrait h-32 max-w-full shrink-0 self-center sm:h-40 md:h-56 md:max-w-[46%]"
              loading="eager"
              draggable={false}
            />
          )}
        </div>
      </div>

      {/* ── The evidence wall. ── */}
      {current &&
        (imageProofs.length > 0 ||
          linkProofs.length > 0 ||
          unreachableProofs.length > 0) && (
          <div className="mt-8">
            <SectionHead
              title="Proof"
              aside={
                current.verifiedAt ? 'archived at verification' : undefined
              }
            />
            <div className="flex flex-wrap items-start gap-3.5">
              {imageProofs.map((p) => (
                <a
                  key={p.id}
                  href={p.url!}
                  target="_blank"
                  rel="noreferrer"
                  className="proof-thumb"
                >
                  <img
                    src={p.url!}
                    alt={`${PROOF_KIND_LABEL[p.kind] ?? p.kind} screenshot — verification proof`}
                    loading="lazy"
                  />
                </a>
              ))}
              {linkProofs.map((p) => (
                <a
                  key={p.id}
                  href={p.url!}
                  target="_blank"
                  rel="noreferrer"
                  className="glass-thin inline-flex items-center gap-1.5 px-3.5 py-2 text-[0.8125rem] font-medium text-fg-muted no-underline transition-colors hover:text-fg"
                >
                  {PROOF_KIND_LABEL[p.kind] ?? p.kind}
                  <span className="text-fg-faint">· {proofHost(p.url!)} ↗</span>
                </a>
              ))}
              {unreachableProofs.map((p) => (
                <span
                  key={p.id}
                  className="glass-thin inline-flex items-center gap-1.5 px-3.5 py-2 text-[0.8125rem] font-medium text-fg-faint"
                >
                  {PROOF_KIND_LABEL[p.kind] ?? p.kind}
                  <span>· archived</span>
                </span>
              ))}
            </div>
          </div>
        )}

      {/* ── How the record climbed. ── */}
      {history.length >= 2 && (
        <div className="mt-8">
          <SectionHead
            title="Record history"
            aside={`${history.length} verified lives`}
          />
          <div
            className={`grid items-stretch gap-3.5 ${titleSteps.length >= 2 ? 'lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]' : ''}`}
          >
            {titleSteps.length >= 2 && <RecordHistory steps={titleSteps} />}
            <div className="glass-mid overflow-hidden">
              <ol>
                {[...history].reverse().map((h, i) => (
                  <li
                    key={`${h.playerSlug}-${h.kills}-${i}`}
                    className="grid grid-cols-[3.25rem_minmax(0,1fr)_auto] items-baseline gap-3 border-b border-hairline-soft px-5 py-3 last:border-b-0"
                  >
                    <span
                      className={`text-right text-[1.0625rem] font-bold tabular-nums ${h.isCurrent ? 'text-fg' : 'text-fg-muted'}`}
                    >
                      {h.kills}
                    </span>
                    <span className="min-w-0 truncate text-[0.9375rem]">
                      <span
                        className={
                          h.isCurrent
                            ? 'font-semibold text-fg'
                            : 'text-fg-muted'
                        }
                      >
                        <RecordName
                          displayName={h.displayName}
                          playerSlug={h.playerSlug}
                          ignSnapshot={h.ignSnapshot}
                          displayNameSnapshot={h.displayNameSnapshot}
                        />
                      </span>
                      {h.isCurrent && (
                        <span className="ml-2 text-[0.6875rem] font-semibold tracking-[0.08em] text-fg-muted uppercase">
                          holds it
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-fg-faint">
                      {h.verifiedAt ? formatDayYear(h.verifiedAt) : 'migrated'}
                      {` · ${h.patch}`}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
