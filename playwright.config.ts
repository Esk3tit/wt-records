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
  globalSetup: './e2e/global-setup.ts',
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
    // Gecko renders gradients differently enough to need its own fix, and no
    // amount of Chromium proves anything about it. These two carry testMatch
    // and the project above does not, so the dither spec runs in all three:
    // Gecko asserts the fix works, the other two that it stays invisible.
    // Scoping is only to keep the rest of the suite on one engine.
    {
      name: 'firefox',
      use: devices['Desktop Firefox'],
      testMatch: /firefox-dither\.spec\.ts/,
      dependencies: ['setup'],
    },
    {
      name: 'webkit',
      use: devices['Desktop Safari'],
      testMatch: /firefox-dither\.spec\.ts/,
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
        env: {
          PORT: new URL(BASE_URL).port,
          // Avatar URLs exist only where an asset host is configured, and which
          // Avatar a viewer is served is an assertion the suite makes. The test
          // server stands in for the bucket with no bucket behind it: every
          // invented key 404s and falls back to the Medallion, while a case
          // that needs an image that genuinely loads — the Review screen will
          // not let a Moderator publish one nobody could see — can name a file
          // under `public/`.
          R2_ASSETS_BASE_URL: process.env.R2_ASSETS_BASE_URL ?? BASE_URL,
        },
        // Never adopt a server already on this port: two checkouts can hash to
        // the same one, and adopting it silently tests the wrong branch.
        reuseExistingServer: false,
        timeout: 120_000,
        stdout: 'pipe',
        stderr: 'pipe',
      },
})
