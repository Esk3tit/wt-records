import { mkdir, writeFile } from 'node:fs/promises'
import { test as setup } from '@playwright/test'
import { anonymousStorageState, mintStorageState } from './support/session'
import { AUTH_DIR, STATE } from './support/states'
import { TEST_USERS, provisionTestUsers } from './support/users'

setup('mint signed-in states', async () => {
  setup.setTimeout(60_000)
  await provisionTestUsers()
  await mkdir(AUTH_DIR, { recursive: true })

  const [admin, user] = await Promise.all([
    mintStorageState(TEST_USERS.moderator.email, TEST_USERS.moderator.password),
    mintStorageState(TEST_USERS.viewer.email, TEST_USERS.viewer.password),
  ])

  await Promise.all([
    writeFile(STATE.admin, JSON.stringify(admin, null, 2)),
    writeFile(STATE.user, JSON.stringify(user, null, 2)),
    writeFile(STATE.anon, JSON.stringify(anonymousStorageState(), null, 2)),
  ])
})
