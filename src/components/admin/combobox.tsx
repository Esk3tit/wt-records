import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { inputClass } from '#/components/admin/ui'

/* Async typeahead for the entry form (vehicles, players): fetch on debounce,
   keyboard navigation, stale responses dropped. */

export interface ComboboxProps<T> {
  id: string
  placeholder: string
  fetchItems: (q: string) => Promise<T[]>
  itemKey: (item: T) => string | number
  renderItem: (item: T) => ReactNode
  onSelect: (item: T) => void
  onClear?: () => void
  /** An always-available final option (e.g. inline create) — part of the
      keyboard cycle, unlike decoration. */
  action?: { label: (q: string) => ReactNode; onAction: (q: string) => void }
  selectedLabel?: string | null
  /** Discards the query, open results and in-flight fetches when it changes —
      pass the value the fetcher closes over (e.g. the mode). */
  resetKey?: unknown
  /** Surfaces a failed lookup (the list closes either way). */
  onError?: (error: unknown) => void
  autoFocus?: boolean
}

export function AsyncCombobox<T>({
  id,
  placeholder,
  fetchItems,
  itemKey,
  renderItem,
  onSelect,
  onClear,
  action,
  selectedLabel,
  resetKey,
  onError,
  autoFocus,
}: ComboboxProps<T>) {
  const [value, setValue] = useState('')
  const [items, setItems] = useState<T[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const seq = useRef(0)
  // After a pick the input unmounts; land focus on the Change button so a
  // keyboard flow never drops to <body> mid-entry.
  const justPicked = useRef(false)
  const changeRef = useRef<HTMLButtonElement>(null)

  // Latest fetcher behind a ref: only typing re-triggers the debounce, never
  // a parent re-render handing down a new callback identity.
  const fetchRef = useRef(fetchItems)
  const onErrorRef = useRef(onError)
  useEffect(() => {
    fetchRef.current = fetchItems
    onErrorRef.current = onError
  })

  useEffect(() => {
    seq.current++
    setValue('')
    setItems([])
    setOpen(false)
    setActive(-1)
  }, [resetKey])

  useEffect(() => {
    const q = value.trim()
    if (!q) {
      seq.current++
      setItems([])
      setOpen(false)
      setActive(-1)
      return
    }
    const requestId = ++seq.current
    const timer = setTimeout(() => {
      fetchRef.current(q).then(
        (rows) => {
          if (seq.current !== requestId) return
          setItems(rows)
          setOpen(true)
          setActive(rows.length > 0 ? 0 : action ? 0 : -1)
        },
        (error: unknown) => {
          // A failed fetch must not read as "No matches" — close the list.
          if (seq.current !== requestId) return
          setItems([])
          setOpen(false)
          setActive(-1)
          onErrorRef.current?.(error)
        },
      )
    }, 150)
    return () => clearTimeout(timer)
  }, [value])

  const q = value.trim()
  const hasAction = Boolean(action && q)
  // The action row sits at index items.length in one keyboard cycle.
  const optionCount = items.length + (hasAction ? 1 : 0)

  const close = () => {
    setOpen(false)
    setValue('')
    setItems([])
    setActive(-1)
  }

  const pick = (index: number) => {
    if (index < items.length) {
      const item = items[index]
      if (!item) return
      onSelect(item)
    } else if (hasAction) {
      action!.onAction(q)
    }
    justPicked.current = true
    close()
  }

  useEffect(() => {
    if (selectedLabel != null && justPicked.current) {
      justPicked.current = false
      changeRef.current?.focus()
    }
  }, [selectedLabel])

  if (selectedLabel != null) {
    return (
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate rounded border border-hairline-soft bg-[var(--pill-track)] px-3 py-1.5 text-sm">
          {selectedLabel}
        </span>
        {onClear && (
          <button
            ref={changeRef}
            type="button"
            onClick={onClear}
            className="text-xs text-fg-muted hover:text-fg"
          >
            Change
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        aria-activedescendant={
          open && active >= 0 ? `${id}-opt-${active}` : undefined
        }
        autoComplete="off"
        autoFocus={autoFocus}
        value={value}
        placeholder={placeholder}
        className={inputClass}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (!open) return
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActive((a) => Math.min(a + 1, optionCount - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((a) => Math.max(a - 1, 0))
          } else if (e.key === 'Enter' && active >= 0) {
            e.preventDefault()
            pick(active)
          } else if (e.key === 'Escape') {
            // Invalidate any in-flight lookup so it can't reopen the list.
            seq.current++
            setOpen(false)
          }
        }}
        onBlur={() =>
          setTimeout(() => {
            seq.current++
            // Unpicked text is stale the moment focus leaves.
            close()
          }, 120)
        }
      />
      {/* Result count for screen readers — visual users see the list. */}
      <span role="status" aria-live="polite" className="sr-only">
        {open
          ? `${items.length} result${items.length === 1 ? '' : 's'}${hasAction ? ', plus create option' : ''}`
          : ''}
      </span>
      {open && (
        <ul
          id={`${id}-list`}
          role="listbox"
          className="menu-glass absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-[14px] p-1"
        >
          {items.map((item, i) => (
            // The option itself is the interactive element — a nested button
            // would put a second control inside role="option".
            <li
              key={itemKey(item)}
              id={`${id}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              className={
                'cursor-pointer rounded-[10px] px-3 py-1.5 text-sm ' +
                (i === active ? 'bg-[var(--pill-active)]' : 'hover:bg-white/5')
              }
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(i)}
              onMouseEnter={() => setActive(i)}
            >
              {renderItem(item)}
            </li>
          ))}
          {items.length === 0 && !hasAction && (
            <li className="px-3 py-1.5 text-sm text-fg-faint">No matches</li>
          )}
          {items.length >= 8 && (
            <li aria-hidden="true" className="px-3 py-1 text-xs text-fg-faint">
              Keep typing to narrow the list
            </li>
          )}
          {hasAction && (
            <li
              key="__action"
              id={`${id}-opt-${items.length}`}
              role="option"
              aria-selected={active === items.length}
              className={
                'cursor-pointer rounded-[10px] px-3 py-1.5 text-sm text-fg-muted ' +
                (items.length > 0 ? 'border-t border-hairline-soft ' : '') +
                (active === items.length
                  ? 'bg-[var(--pill-active)] text-fg'
                  : 'hover:bg-white/5')
              }
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(items.length)}
              onMouseEnter={() => setActive(items.length)}
            >
              {action!.label(q)}
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
