const DAY_MS = 86_400_000

// Loader data crosses the server-function serialization boundary; accept the
// string form too so a serialized Date can never crash a formatter.
type DateLike = Date | string
const asDate = (v: DateLike) => (v instanceof Date ? v : new Date(v))

// Fixed locale + UTC keep server and client renders byte-identical.
const day = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
})
const dayYear = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})
const monthYear = new Intl.DateTimeFormat('en-GB', {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

export const formatDay = (d: DateLike) => day.format(asDate(d))
export const formatDayYear = (d: DateLike) => dayYear.format(asDate(d))

// Feed stamps: same-year dates stay terse; older ones must carry their year.
export function formatFeedDay(d: DateLike): string {
  const date = asDate(d)
  return date.getUTCFullYear() === new Date().getUTCFullYear()
    ? day.format(date)
    : dayYear.format(date)
}
export const formatMonthYear = (d: DateLike) => monthYear.format(asDate(d))

// UTC like every formatter here, so server and client agree on the boundary.
export function isToday(d: DateLike): boolean {
  const a = asDate(d)
  const b = new Date()
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  )
}

export function daysSince(d: DateLike): number {
  return Math.max(0, Math.floor((Date.now() - asDate(d).getTime()) / DAY_MS))
}

export function formatDaysAgo(d: DateLike): string {
  const days = daysSince(d)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 14) return `${days} days ago`
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`
  return `${Math.floor(days / 30)} months ago`
}

export function formatDuration(secs: number): string {
  if (secs < 3600) return `${Math.max(1, Math.round(secs / 60))} min`
  if (secs < (2 * DAY_MS) / 1000) return `${Math.round(secs / 3600)} h`
  return `${Math.round(secs / (DAY_MS / 1000))} d`
}

// The registry week is Monday-start, matching Postgres date_trunc('week').
export function weekRangeLabel(now = new Date()): string {
  const dow = (now.getUTCDay() + 6) % 7
  const monday = new Date(now.getTime() - dow * DAY_MS)
  const sunday = new Date(monday.getTime() + 6 * DAY_MS)
  return `Mon ${formatDay(monday)} – Sun ${formatDay(sunday)}`
}
