import { BadgeCheck } from 'lucide-react'

/* The claimed indicator — subtle, and only on profile/detail surfaces (never
   record rows, leaderboards, or share cards). */
export function ClaimedChip() {
  return (
    <span className="chip-well inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium tracking-wide text-fg uppercase">
      <BadgeCheck size={12} aria-hidden />
      Claimed
    </span>
  )
}
