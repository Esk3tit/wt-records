import { useNavigate } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useEffect, useRef, useState } from 'react'
import { NationFlag } from '#/components/nation-flag'
import { VehicleTags } from '#/components/vehicle-tags'
import { db } from '#/db'
import { lookupVehicles } from '#/db/queries'
import { formatBr } from '#/lib/format'

const suggestVehicles = createServerFn({ method: 'GET' })
  .validator((data: { mode: string; q: string }) => data)
  .handler(({ data }) => lookupVehicles(db, data.mode, data.q))

type Suggestion = Awaited<ReturnType<typeof lookupVehicles>>[number]

/** Hero Lookup: resolves a vehicle name straight to its page; free text
 * falls through to Browse. A combobox, not a search box. */
export function VehicleLookup({ mode }: { mode: string }) {
  const navigate = useNavigate()
  const [value, setValue] = useState('')
  const [items, setItems] = useState<Suggestion[]>([])
  const [open, setOpen] = useState(false)
  // -1 = free text; items.length = the "All results →" row.
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
    const id = ++seq.current
    const timer = setTimeout(() => {
      suggestVehicles({ data: { mode, q } }).then(
        (rows) => {
          // A slower earlier response must not clobber a newer query's list.
          if (seq.current !== id) return
          setItems(rows)
          setOpen(true)
          setActive(-1)
        },
        () => undefined,
      )
    }, 150)
    return () => clearTimeout(timer)
  }, [value, mode])

  const go = (index: number) => {
    setOpen(false)
    const picked = index >= 0 ? items[index] : undefined
    if (picked) {
      navigate({
        to: '/$mode/vehicle/$slug',
        params: { mode, slug: picked.slug },
      })
    } else if (value.trim()) {
      navigate({
        to: '/$mode/vehicles',
        params: { mode },
        search: { q: value.trim() },
      })
    }
  }

  const optionCount = items.length + 1
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false)
      return
    }
    if (e.key === 'Enter') {
      // Also fires while the dropdown hasn't opened yet (mid-debounce):
      // free text always falls through to Browse.
      e.preventDefault()
      go(open && active >= 0 && active < items.length ? active : -1)
      return
    }
    if (!open) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, optionCount - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, -1))
    }
  }

  return (
    <div className="relative max-w-[24rem]">
      <label htmlFor="vehicle-lookup" className="sr-only">
        Check a vehicle
      </label>
      <input
        id="vehicle-lookup"
        role="combobox"
        aria-expanded={open}
        aria-controls="vehicle-lookup-listbox"
        aria-autocomplete="list"
        aria-activedescendant={
          open && active >= 0 ? `vehicle-lookup-opt-${active}` : undefined
        }
        type="text"
        autoComplete="off"
        value={value}
        placeholder="Check a vehicle…"
        onChange={(e) => {
          setValue(e.target.value)
          // A hover-highlighted row from the previous query must not stay
          // the Enter target while new suggestions are in flight.
          setActive(-1)
        }}
        onKeyDown={onKeyDown}
        onFocus={() => items.length > 0 && setOpen(true)}
        onBlur={() => setOpen(false)}
        className="w-full rounded-[10px] border border-hairline bg-transparent px-3.5 py-2 text-[0.9375rem] placeholder:text-fg-faint"
      />
      {open && (
        <ul
          id="vehicle-lookup-listbox"
          role="listbox"
          aria-label="Vehicles"
          className="menu-glass absolute top-full right-0 left-0 z-30 mt-1.5 overflow-hidden rounded-[14px] p-1.5"
        >
          {items.map((v, i) => (
            <li
              key={v.slug}
              id={`vehicle-lookup-opt-${i}`}
              role="option"
              aria-selected={active === i}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => go(i)}
              className={
                'flex cursor-pointer items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-sm ' +
                (active === i ? 'bg-[var(--pill-active)]' : '')
              }
            >
              <NationFlag slug={v.nationSlug} />
              <span className="min-w-0 flex-1 truncate">
                {v.name}
                <VehicleTags tags={v} />
              </span>
              <span className="text-xs text-fg-faint">{v.nation}</span>
              {v.br != null && (
                <span className="min-w-[2rem] text-right text-xs text-fg-muted">
                  {formatBr(v.br)}
                </span>
              )}
            </li>
          ))}
          {items.length === 0 && (
            <li
              role="presentation"
              className="px-2.5 py-2 text-sm text-fg-muted"
            >
              No vehicles found.
            </li>
          )}
          <li role="presentation" aria-hidden="true" className="px-1 py-1">
            <span className="block h-px bg-[var(--hairline-soft)]" />
          </li>
          <li
            id={`vehicle-lookup-opt-${items.length}`}
            role="option"
            aria-selected={active === items.length}
            onMouseDown={(e) => e.preventDefault()}
            onMouseEnter={() => setActive(items.length)}
            onClick={() => go(-1)}
            className={
              'cursor-pointer rounded-[10px] px-2.5 py-2 text-[0.8125rem] text-fg-muted ' +
              (active === items.length ? 'bg-[var(--pill-active)] text-fg' : '')
            }
          >
            All results for “{value.trim()}” →
          </li>
        </ul>
      )}
    </div>
  )
}
