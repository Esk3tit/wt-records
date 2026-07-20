import { existsSync } from 'node:fs'
import { defineConfig, devices } from '@playwright/test'

// The suite needs the server-side Supabase/DB vars the app itself reads. CI
// exports them on the job; locally they live in .env like every other script.
// loadEnvFile overwrites, so restore anything the caller set explicitly —
// `SUPABASE_URL=… playwright test` must beat the committed .env.
if (!process.env.CI && existsSync('.env')) {
  const explicit = { ...process.env }
  process.loadEnvFile('.env')
  Object.assign(process.env, explicit)
}

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'

export default defineConfig({
  testDir: './e2e',
  // support/ holds helpers plus their Vitest specs — neither is a Playwright test.
  testIgnore: '**/support/**',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  // Shards emit blob reports for the merge-reports job; locally an HTML report
  // is more useful than a wall of blobs.
  reporter: process.env.CI
    ? [['blob'], ['github'], ['list']]
    : [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      use: devices['Desktop Chrome'],
      dependencies: ['setup'],
    },
  ],
  // Against an already-running target (PLAYWRIGHT_BASE_URL — a deployed
  // preview, or a server the CI job started once for all shards) Playwright
  // manages nothing. Otherwise it boots the built SSR server itself.
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'bun run start',
        url: `${BASE_URL}/healthz`,
        env: { PORT: new URL(BASE_URL).port },
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        stdout: 'pipe',
        stderr: 'pipe',
      },
})
