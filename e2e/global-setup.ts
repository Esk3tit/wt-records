import { basename, join } from 'node:path'
import { acquireStackLock } from './support/stack-lock'

// The returned function is Playwright's global teardown.
export default async function globalSetup(): Promise<() => Promise<void>> {
  return acquireStackLock(basename(join(import.meta.dirname, '..')))
}
