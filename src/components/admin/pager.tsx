/** Offset pager shared by the admin list views. */
export const ADMIN_PAGE_SIZE = 50

export function pageParam(value: unknown): number | undefined {
  const page = Number(value)
  return Number.isInteger(page) && page > 1 ? page : undefined
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
