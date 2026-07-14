import { Link } from '@tanstack/react-router'
import { Brand } from '#/components/brand'
import { CountUp } from '#/components/count-up'
import { ContestedTitles } from '#/components/contested-titles'
import { FallenRecords } from '#/components/fallen-records'
import { LiveFeed } from '#/components/live-feed'
import { LeaderboardList } from '#/components/leaderboard-list'
import { LongestStanding } from '#/components/longest-standing'
import { NationFlag } from '#/components/nation-flag'
import { ModeStats } from '#/components/mode-stats'
import { NationCompletion } from '#/components/nation-completion'
import { Podium } from '#/components/podium'
import { RecordHistory } from '#/components/record-history'
import { RecordMonument } from '#/components/record-monument'
import { SectionHead } from '#/components/section-head'
import { VehicleLookup } from '#/components/vehicle-lookup'
import { VerificationQueue } from '#/components/verification-queue'
import { WeekMarquee } from '#/components/week-marquee'
import { weekRangeLabel } from '#/lib/dates'
import type { getModeLanding } from '#/db/queries'

export type ModeLandingData = Awaited<ReturnType<typeof getModeLanding>>

export function ModeLanding({
  mode,
  modeName,
  data,
}: {
  mode: string
  modeName: string
  data: ModeLandingData
}) {
  const {
    stats,
    leaders,
    topRecords,
    latestFeed,
    weekTop,
    verifyQueue,
    contestedTitles,
    nations,
    historySteps,
    fallen,
    longestStanding,
  } = data
  const monument = topRecords.length > 0 ? topRecords[0] : null
  const anchors = [
    { label: 'Leaderboard', hash: 'standings' },
    ...(contestedTitles.length > 0
      ? [{ label: 'Contested', hash: 'contested-titles' }]
      : []),
    ...(nations.length > 0 ? [{ label: 'Nations', hash: 'nations' }] : []),
  ]

  return (
    <>
      {/* Hero */}
      {/* No overflow-hidden here — the Lookup dropdown must escape the pane;
          the glow gets its own clipper instead. */}
      <section className="glass-thick relative z-10 mt-8 p-8 md:p-10">
        {/* z-0 stacking context: the wash's z-1 stays contained in here */}
        <div
          className="absolute inset-0 z-0 overflow-hidden rounded-[26px]"
          aria-hidden="true"
        >
          <div className="monument-glow" />
          {monument && (
            <NationFlag slug={monument.nationSlug} variant="wash-hero" />
          )}
        </div>
        <div className="relative grid items-start gap-8 md:grid-cols-[1fr_auto]">
          <div className="max-w-[30rem]">
            <p className="kicker">Live registry</p>
            <h1 className="mt-3 text-[clamp(1.875rem,4vw,2.75rem)] leading-[1.05] font-bold tracking-[-0.02em] [text-wrap:balance]">
              {modeName}
            </h1>
            <p className="mt-3 max-w-[32.5rem] text-[1.0625rem] leading-normal text-fg-muted [text-wrap:pretty]">
              Single-life kill records for every vehicle in War Thunder. One
              title per vehicle — only strictly more kills takes it.
            </p>
            <div className="mt-5">
              <VehicleLookup mode={mode} />
            </div>
          </div>
          <RecordMonument
            mode={mode}
            record={monument}
            eligibleVehicles={stats ? stats.eligibleVehicles : 0}
          />
        </div>
        {stats && <ModeStats stats={stats} />}
      </section>

      {/* Section quick links */}
      <nav aria-label="Sections" className="mt-5 flex flex-wrap gap-2.5">
        {anchors.map((l) => (
          <a
            key={l.hash}
            href={`#${l.hash}`}
            className="glass-pill rounded-full px-4 py-2 text-sm no-underline"
          >
            {l.label}
          </a>
        ))}
        <Link
          to="/rules/$mode"
          params={{ mode }}
          className="glass-pill rounded-full px-4 py-2 text-sm no-underline"
        >
          Rules
        </Link>
      </nav>

      {/* The podium + latest-verified rail */}
      {(topRecords.length > 0 || latestFeed.length > 0) && (
        <div className="band-chase mt-12">
          <section className="min-w-0">
            <SectionHead
              title="The podium"
              aside={
                topRecords.length >= 5 ? 'all-time · top five' : 'all-time'
              }
            />
            <Podium mode={mode} records={topRecords} />
          </section>
          <div className="feed-col">
            <div className="feed-rail">
              {/* Keyed so a cross-mode navigation can't diff one mode's rows
                  against another's and misread them as live arrivals. */}
              <LiveFeed key={mode} mode={mode} entries={latestFeed} />
            </div>
          </div>
        </div>
      )}

      {/* This week's records */}
      {weekTop.length > 0 && (
        <section className="mt-12">
          <SectionHead
            title="Top records · this week"
            aside={weekRangeLabel()}
          />
          <WeekMarquee mode={mode} records={weekTop} />
        </section>
      )}

      {/* Record history + verification queue */}
      <div className={historySteps.length > 0 ? 'band-history mt-12' : 'mt-12'}>
        {historySteps.length > 0 && monument && (
          <section className="flex min-w-0 flex-col">
            <SectionHead
              title="Record history"
              aside={`${monument.vehicleName} · ${modeName}`}
            />
            <div className="min-h-0 flex-1">
              <RecordHistory steps={historySteps} />
            </div>
          </section>
        )}
        <section className="flex min-w-0 flex-col">
          <SectionHead title="Verification" aside="queue status" />
          <div className="min-h-0 flex-1">
            <VerificationQueue queue={verifyQueue} />
          </div>
        </section>
      </div>

      {/* Most contested titles + standings */}
      <div className={contestedTitles.length > 0 ? 'band-duo mt-12' : 'mt-12'}>
        {contestedTitles.length > 0 && (
          <section id="contested-titles" className="min-w-0 scroll-mt-24">
            <SectionHead
              title="Most contested titles"
              aside="records set, all-time"
            />
            <ContestedTitles mode={mode} rows={contestedTitles} />
          </section>
        )}
        <section id="standings" className="min-w-0 scroll-mt-24">
          <SectionHead
            title="Leaderboard"
            aside={
              <Link
                to="/$mode/leaderboard"
                params={{ mode }}
                className="font-medium text-fg-muted underline decoration-1 underline-offset-2 hover:text-fg"
              >
                Full leaderboard →
              </Link>
            }
          />
          <div className="standings glass-mid overflow-hidden">
            <LeaderboardList rows={leaders} medals />
          </div>
        </section>
      </div>

      {/* Longest standing + fallen this month */}
      {(longestStanding.length > 0 || fallen.length > 0) && (
        <div
          className={
            longestStanding.length > 0 && fallen.length > 0
              ? 'band-duo mt-12'
              : 'mt-12'
          }
        >
          {longestStanding.length > 0 && (
            <section className="min-w-0">
              <SectionHead title="Longest standing" aside="still unbroken" />
              <LongestStanding mode={mode} rows={longestStanding} />
            </section>
          )}
          {fallen.length > 0 && (
            <section className="min-w-0">
              <SectionHead
                title="Fallen this month"
                aside="records that changed hands"
              />
              <FallenRecords mode={mode} rows={fallen} />
            </section>
          )}
        </div>
      )}

      {/* Nation completion */}
      {nations.length > 0 && (
        <section id="nations" className="mt-12 scroll-mt-24">
          <SectionHead
            title="Nation completion"
            aside={
              <Link
                to="/$mode/nations"
                params={{ mode }}
                className="font-medium text-fg-muted underline decoration-1 underline-offset-2 hover:text-fg"
              >
                Nation registry →
              </Link>
            }
          />
          <NationCompletion mode={mode} nations={nations} />
        </section>
      )}

      {/* Open titles */}
      {stats && stats.remainingVehicles > 0 && (
        <section className="glass-thin mt-12 flex flex-wrap items-center justify-between gap-x-8 gap-y-4 rounded-[22px] px-6 py-5">
          <div className="flex items-center gap-4">
            <p className="text-4xl leading-none font-bold tracking-[-0.03em] text-fg">
              <CountUp value={stats.remainingVehicles} />
            </p>
            <p className="max-w-[26rem] text-[0.9375rem] leading-snug text-fg-muted">
              titles still unclaimed in {modeName} — vehicles with no verified
              holder. First verified life takes the record.
            </p>
          </div>
          <Link
            to="/$mode/vehicles"
            params={{ mode }}
            search={{ status: 'open' }}
            className="rounded-[4px] border border-hairline px-3 py-1.5 text-sm font-medium text-fg-muted no-underline transition-colors hover:text-fg"
          >
            Browse open titles
          </Link>
        </section>
      )}

      <footer className="mt-16 flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2 text-xs text-fg-faint">
        <p>
          <Brand />
        </p>
        <p>
          Records are held, verified, chased. Removed vehicles always count.
        </p>
      </footer>
    </>
  )
}
