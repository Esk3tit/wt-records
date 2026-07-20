import { existsSync } from 'node:fs'
import { defineConfig, devices } from '@playwright/test'
import { baseUrl } from './e2e/support/env'

// The suite reads the same server-side Supabase/DB vars the app does. CI sets
// them on the job; locally they're in .env — which loadEnvFile would overwrite,
// so an explicitly exported var is restored and wins.
if (!process.env.CI && existsSync('.env')) {
  const explicit = { ...process.env }
  process.loadEnvFile('.env')
  Object.assign(process.env, explicit)
}

const BASE_URL = baseUrl()

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
  // PLAYWRIGHT_BASE_URL targets a server someone else is running (a deployed
  // preview); without it Playwright boots the built SSR server itself.
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
