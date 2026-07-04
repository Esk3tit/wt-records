// Metadata only: the vehicle left the game, but its records stand and owners
// can still set new ones. It is otherwise treated like any other vehicle.
export function RemovedTag() {
  return (
    <span
      className="ml-2 rounded bg-tint-strong px-1.5 py-0.5 text-xs tracking-wide text-fg-faint uppercase"
      title="Removed from the game — records still count"
    >
      removed
    </span>
  )
}
