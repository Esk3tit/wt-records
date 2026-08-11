import { ADMIN_PAGE_SIZE } from '#/lib/paging'

export { ADMIN_PAGE_SIZE }

/** Offset pager shared by the admin list views. */
export function pageParam(value: unknown): number | undefined {
  const page = Number(value)
  if (!Number.isInteger(page) || page <= 1) return undefined
  // A page from the URL becomes page × size downstream, and past this it stops
  // being a number arithmetic can trust — clamped, not rejected, so a nonsense
  // page lands on the last one instead of throwing out of a loader.
  return Math.min(page, Math.floor(Number.MAX_SAFE_INTEGER / ADMIN_PAGE_SIZE))
}

export function Pager({
  page,
  hasMore,
  onPage,
  total,
  pageSize = ADMIN_PAGE_SIZE,
  prevLabel = '← Newer',
  nextLabel = 'Older →',
}: {
  page: number
  hasMore: boolean
  onPage: (page: number | undefined) => void
  total?: number
  pageSize?: number
  prevLabel?: string
  nextLabel?: string
}) {
  if (page <= 1 && !hasMore) return null
  const totalPages =
    total != null ? Math.max(1, Math.ceil(total / pageSize)) : null
  return (
    <div className="mt-4 flex items-center justify-between text-sm">
      <button
        type="button"
        disabled={page <= 1}
        className="text-fg-muted hover:text-fg disabled:opacity-40"
        onClick={() => onPage(page > 2 ? page - 1 : undefined)}
      >
        {prevLabel}
      </button>
      <span className="text-fg-faint tabular-nums">
        Page {page}
        {totalPages != null ? ` of ${totalPages}` : ''}
      </span>
      <button
        type="button"
        disabled={!hasMore}
        className="text-fg-muted hover:text-fg disabled:opacity-40"
        onClick={() => onPage(page + 1)}
      >
        {nextLabel}
      </button>
    </div>
  )
}
