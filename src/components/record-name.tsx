import { Link } from '@tanstack/react-router'

export interface RecordNameProps {
  displayName: string
  playerSlug: string
  ignSnapshot?: string | null
  displayNameSnapshot?: string | null
}

// Snapshots are the immutable at-submission names; collapse them when they
// still equal the player's current display name.
export function RecordName({
  displayName,
  playerSlug,
  ignSnapshot,
  displayNameSnapshot,
}: RecordNameProps) {
  const secondary: string[] = []
  if (ignSnapshot && ignSnapshot !== displayName)
    secondary.push(`as «${ignSnapshot}»`)
  if (
    displayNameSnapshot &&
    displayNameSnapshot !== displayName &&
    displayNameSnapshot !== ignSnapshot
  )
    secondary.push(`formerly «${displayNameSnapshot}»`)

  return (
    <span>
      <Link to="/player/$slug" params={{ slug: playerSlug }}>
        {displayName}
      </Link>
      {secondary.length > 0 && (
        <span className="ml-2 text-fg-faint">{secondary.join(' · ')}</span>
      )}
    </span>
  )
}
