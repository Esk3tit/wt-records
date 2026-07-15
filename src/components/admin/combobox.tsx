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
  /** Rendered under the list, e.g. an inline-create row. */
  footer?: (q: string, close: () => void) => ReactNode
  selectedLabel?: string | null
}

export function AsyncCombobox<T>({
  id,
  placeholder,
  fetchItems,
  itemKey,
  renderItem,
  onSelect,
  onClear,
  footer,
  selectedLabel,
}: ComboboxProps<T>) {
  const [value, setValue] = useState('')
  const [items, setItems] = useState<T[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const seq = useRef(0)

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
      fetchItems(q).then(
        (rows) => {
          if (seq.current !== requestId) return
          setItems(rows)
          setOpen(true)
          setActive(rows.length > 0 ? 0 : -1)
        },
        () => {
          if (seq.current === requestId) setItems([])
        },
      )
    }, 150)
    return () => clearTimeout(timer)
  }, [value, fetchItems])

  const close = () => {
    setOpen(false)
    setValue('')
    setItems([])
  }

  const pick = (item: T) => {
    onSelect(item)
    close()
  }

  if (selectedLabel != null) {
    return (
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate rounded-[10px] border border-hairline-soft bg-[var(--pill-track)] px-3 py-1.5 text-sm">
          {selectedLabel}
        </span>
        {onClear && (
          <button
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
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        className={inputClass}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (!open) return
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActive((a) => Math.min(a + 1, items.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((a) => Math.max(a - 1, 0))
          } else if (e.key === 'Enter' && active >= 0 && items[active]) {
            e.preventDefault()
            pick(items[active])
          } else if (e.key === 'Escape') {
            setOpen(false)
          }
        }}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
      />
      {open && (
        <ul
          id={`${id}-list`}
          role="listbox"
          className="menu-glass absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-[14px] p-1"
        >
          {items.map((item, i) => (
            <li key={itemKey(item)} role="option" aria-selected={i === active}>
              <button
                type="button"
                className={
                  'w-full rounded-[10px] px-3 py-1.5 text-left text-sm ' +
                  (i === active
                    ? 'bg-[var(--pill-active)]'
                    : 'hover:bg-white/5')
                }
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(item)}
                onMouseEnter={() => setActive(i)}
              >
                {renderItem(item)}
              </button>
            </li>
          ))}
          {items.length === 0 && (
            <li className="px-3 py-1.5 text-sm text-fg-faint">No matches</li>
          )}
          {footer?.(value.trim(), close)}
        </ul>
      )}
    </div>
  )
}
