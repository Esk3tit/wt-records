import { Link } from '@tanstack/react-router'
import { RecordName } from '#/components/record-name'
import { RemovedTag } from '#/components/removed-tag'

export interface TopRecordRow {
  kills: number
  vehicleSlug: string
  vehicleName: string
  isRemoved: boolean
  nationName: string
  playerSlug: string
  displayName: string
  ignSnapshot: string | null
  displayNameSnapshot: string | null
}

const POS_LABEL = ['#1 · All-time high', '#2', '#3']

export function TopRecords({
  mode,
  records,
}: {
  mode: string
  records: TopRecordRow[]
}) {
  return (
    <ol className="grid gap-3.5 sm:grid-cols-2 md:grid-cols-[1.4fr_1fr_1fr]">
      {records.map((r, i) => (
        <li
          key={r.vehicleSlug}
          className={
            'glass-mid pane-lift relative overflow-hidden p-5.5 sm:first:col-span-2 md:first:col-span-1 ' +
            (i === 0 ? 'record-lead' : '')
          }
        >
          <p className="text-[0.6875rem] font-semibold tracking-[0.12em] text-fg-muted uppercase">
            {POS_LABEL[i]}
          </p>
          <p
            className={
              'mt-2 leading-none font-bold tracking-[-0.03em] ' +
              (i === 0 ? 'text-7xl text-accent-text' : 'text-5xl text-fg')
            }
          >
            {r.kills}
            <span className="ml-1 text-[0.8125rem] font-medium tracking-[0.06em] text-fg-muted">
              kills
            </span>
          </p>
          <p className="mt-3.5 text-[1.0625rem] font-semibold">
            <Link
              to="/$mode/vehicle/$slug"
              params={{ mode, slug: r.vehicleSlug }}
              className="no-underline hover:underline"
            >
              {r.vehicleName}
            </Link>
            {r.isRemoved && <RemovedTag />}
          </p>
          <p className="mt-0.5 text-[0.8125rem] text-fg-muted">
            <RecordName
              displayName={r.displayName}
              playerSlug={r.playerSlug}
              ignSnapshot={r.ignSnapshot}
              displayNameSnapshot={r.displayNameSnapshot}
            />
            {' · '}
            {r.nationName}
          </p>
        </li>
      ))}
    </ol>
  )
}
