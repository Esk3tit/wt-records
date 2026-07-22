import { Link } from '@tanstack/react-router'
import { NationFlag } from '#/components/nation-flag'
import { RecordName } from '#/components/record-name'
import { VehicleTags } from '#/components/vehicle-tags'
import { formatBr } from '#/lib/format'
import type { VehicleTagFlags } from '#/components/vehicle-tags'

export interface LedgerVehicleRow extends VehicleTagFlags {
  vehicleSlug: string
  vehicleName: string
  isDifficult: boolean
  nationSlug: string
  nationName: string
  br: number | null
  kills: number | null
  playerSlug: string | null
  displayName: string | null
  ignSnapshot: string | null
  displayNameSnapshot: string | null
}

export const LEDGER_TH =
  'py-3 pr-4 text-left text-xs font-semibold tracking-wide text-fg-muted uppercase'
export const LEDGER_ROW =
  'border-t border-hairline-soft transition-colors duration-150 hover:bg-[var(--row-hover)]'

export function LedgerPane({ children }: { children: React.ReactNode }) {
  return (
    <div className="glass-mid overflow-x-auto">
      <table className="w-full text-left text-[0.9375rem]">{children}</table>
    </div>
  )
}

export function VehicleCell({
  mode,
  row,
  nationChip = 'none',
}: {
  mode: string
  row: LedgerVehicleRow
  /** `mobile`: show the flag chip only below md, where the Nation column folds
      into this cell. */
  nationChip?: 'none' | 'mobile'
}) {
  return (
    <td className="py-2.5 pr-4 pl-5">
      {/* Wrapper span, not a utility on the chip: the unlayered .flag-chip
          display rule would win over `md:hidden`. */}
      {nationChip === 'mobile' && (
        <span className="mr-2 md:hidden">
          <NationFlag slug={row.nationSlug} />
        </span>
      )}
      <Link
        to="/$mode/vehicle/$slug"
        params={{ mode, slug: row.vehicleSlug }}
        className="font-medium no-underline hover:underline"
      >
        {row.vehicleName}
      </Link>
      {row.isDifficult && (
        <span
          className="ml-1.5 text-fg-faint"
          title="Difficult vehicle — higher qualifying kill bar"
        >
          ◆
        </span>
      )}
      <VehicleTags tags={row} />
    </td>
  )
}

export function NationCell({ row }: { row: LedgerVehicleRow }) {
  return (
    <td className="hidden py-2.5 pr-4 text-[0.8125rem] whitespace-nowrap text-fg-muted md:table-cell">
      <NationFlag slug={row.nationSlug} className="mr-2" />
      {row.nationName}
    </td>
  )
}

export function BrCell({ br }: { br: number | null }) {
  return (
    <td className="hidden py-2.5 pr-4 text-right text-[0.8125rem] text-fg-muted sm:table-cell">
      {br != null ? formatBr(br) : <span className="text-fg-faint">—</span>}
    </td>
  )
}

export function KillsCell({ kills }: { kills: number | null }) {
  return (
    <td className="py-2.5 pr-4 text-right">
      {kills != null ? (
        <span className="font-bold text-fg">{kills}</span>
      ) : (
        <span className="text-fg-faint">—</span>
      )}
    </td>
  )
}

export function HolderCell({ row }: { row: LedgerVehicleRow }) {
  return (
    <td className="py-2.5 pr-5 [&_a]:no-underline [&_a:hover]:underline">
      {row.playerSlug && row.displayName ? (
        <RecordName
          displayName={row.displayName}
          playerSlug={row.playerSlug}
          ignSnapshot={row.ignSnapshot}
          displayNameSnapshot={row.displayNameSnapshot}
        />
      ) : (
        <span className="text-fg-faint">Open bounty</span>
      )}
    </td>
  )
}

export function LedgerEmptyRow({
  colSpan,
  onReset,
}: {
  colSpan: number
  onReset: () => void
}) {
  return (
    <tr className="border-t border-hairline-soft">
      <td colSpan={colSpan} className="px-5 py-12 text-center">
        <p className="text-fg-muted">No vehicles match these filters.</p>
        <button
          type="button"
          onClick={onReset}
          className="mt-4 rounded-[10px] border border-hairline px-3.5 py-1.5 text-[0.8125rem] font-medium text-fg-muted transition-colors duration-150 hover:border-[var(--hairline-hover)] hover:text-fg"
        >
          Reset filters
        </button>
      </td>
    </tr>
  )
}
