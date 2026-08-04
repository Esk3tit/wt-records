import { assertDisposableTarget, checkoutName } from './support/env'
import { acquireStackLock } from './support/stack-lock'

// The returned function is Playwright's global teardown. Assert the target
// first: this opens a connection, and .env has pointed at production before.
export default async function globalSetup(): Promise<() => Promise<void>> {
  assertDisposableTarget()
  return acquireStackLock(checkoutName())
}
