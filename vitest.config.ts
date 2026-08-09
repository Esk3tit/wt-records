import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Two projects in one repo: a jsdom unit project (React/components/pure logic)
// and a node project for PGlite integration tests.
export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'jsdom',
          // e2e/ is Playwright's, but its pure support helpers are plain logic
          // and belong in the fast suite rather than behind a browser run.
          include: [
            'src/**/*.test.{ts,tsx}',
            'e2e/support/**/*.test.ts',
            'scripts/**/*.test.ts',
          ],
          // Don't double-run integration tests colocated in src/ (they belong to
          // the node `integration` project); keep Vitest's default excludes.
          exclude: [
            ...configDefaults.exclude,
            'src/**/*.integration.test.{ts,tsx}',
          ],
          setupFiles: ['./tests/setup.unit.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          environment: 'node',
          include: [
            'tests/integration/**/*.test.ts',
            'src/**/*.integration.test.ts',
          ],
          // Every test boots its own PGlite; the default 10s hook timeout is
          // shorter than that boot takes once the whole suite contends for the
          // machine, which failed a different arbitrary set of files each run.
          hookTimeout: 60_000,
          testTimeout: 60_000,
        },
      },
    ],
  },
})
