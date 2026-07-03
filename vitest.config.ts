import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Two projects in one repo: a jsdom unit project (React/components/pure logic)
// and a node project for PGlite integration tests (added in PR2).
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
          include: ['src/**/*.test.{ts,tsx}'],
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
        },
      },
    ],
  },
})
