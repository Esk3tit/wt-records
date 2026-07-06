import { Chip } from '#/components/chip'

// Metadata only: the vehicle left the game, but its records stand and owners
// can still set new ones. It is otherwise treated like any other vehicle.
export function RemovedTag() {
  return (
    <Chip title="Removed from the game — records still count">removed</Chip>
  )
}
