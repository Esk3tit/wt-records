import { formatDuration } from '#/lib/dates'

export interface VerifyQueueData {
  pending: number
  verifiedThisWeek: number
  medianReviewSecs: number | null
}

export function VerificationQueue({ queue }: { queue: VerifyQueueData }) {
  const stats = [
    { label: 'Pending review', value: queue.pending },
    {
      label: 'Median review time',
      value:
        queue.medianReviewSecs == null
          ? '—'
          : formatDuration(queue.medianReviewSecs),
    },
    { label: 'Verified this week', value: queue.verifiedThisWeek },
  ]
  return (
    <div className="glass-mid flex h-full flex-col px-6 py-2">
      <dl>
        {stats.map((s) => (
          <div
            key={s.label}
            className="flex items-baseline justify-between border-b border-hairline-soft py-4"
          >
            <dt className="text-[0.8125rem] text-fg-muted">{s.label}</dt>
            <dd className="text-2xl font-bold tabular-nums text-fg">
              {s.value}
            </dd>
          </div>
        ))}
      </dl>
      <p className="py-4 text-xs leading-normal text-fg-faint">
        Every submission is reviewed by a moderator before it enters the
        registry. No exceptions, no auto-accepts.
      </p>
    </div>
  )
}
