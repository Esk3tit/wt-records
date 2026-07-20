import { createClient } from '@supabase/supabase-js'
import postgres from 'postgres'
import { assertDisposableTarget, requireEnv } from './env'

/** The suite's two identities. Passwords are fixtures for a throwaway local
    stack — the real sessions are minted fresh per run, never committed. */
export const TEST_USERS = {
  admin: {
    email: 'e2e-moderator@wt-records.test',
    password: 'e2e-moderator-password',
    handle: 'E2E Moderator',
    role: 'moderator',
  },
  user: {
    email: 'e2e-viewer@wt-records.test',
    password: 'e2e-viewer-password',
    handle: 'E2E Viewer',
    role: 'viewer',
  },
} as const

export type TestUserKey = keyof typeof TEST_USERS

/** Creates (or resets) each auth user and pins its profile role. Idempotent so
    a repeated local run doesn't trip over users the previous run left behind. */
export async function provisionTestUsers(): Promise<void> {
  assertDisposableTarget()
  const admin = createClient(
    requireEnv('SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
  const sql = postgres(requireEnv('DATABASE_URL'), {
    prepare: false,
    connect_timeout: 10,
  })

  try {
    for (const user of Object.values(TEST_USERS)) {
      const id = await upsertAuthUser(
        admin.auth.admin,
        user.email,
        user.password,
      )
      // profiles.id IS the auth user id, and the OAuth upsert deliberately
      // never sets role — so the fixture pins it the same way a real
      // promotion does.
      await sql`
        insert into profiles (id, handle, role)
        values (${id}, ${user.handle}, ${user.role})
        on conflict (id) do update
          set handle = excluded.handle, role = excluded.role
      `
    }
  } finally {
    await sql.end()
  }
}

type AuthAdmin = ReturnType<typeof createClient>['auth']['admin']

async function upsertAuthUser(
  admin: AuthAdmin,
  email: string,
  password: string,
): Promise<string> {
  const created = await admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (created.data.user) return created.data.user.id

  const existing = await findUserByEmail(admin, email)
  if (!existing) {
    throw new Error(
      `could not create or find the test user ${email}: ${created.error?.message}`,
    )
  }
  const updated = await admin.updateUserById(existing, {
    password,
    email_confirm: true,
  })
  if (updated.error) {
    throw new Error(`could not reset ${email}: ${updated.error.message}`)
  }
  return existing
}

async function findUserByEmail(
  admin: AuthAdmin,
  email: string,
): Promise<string | null> {
  const { data, error } = await admin.listUsers({ perPage: 200 })
  if (error) throw new Error(`could not list auth users: ${error.message}`)
  return data.users.find((u) => u.email === email)?.id ?? null
}
