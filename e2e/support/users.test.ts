import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { provisionTestUsers } from './users'

const mocks = vi.hoisted(() => ({
  createUser: vi.fn(),
  updateUserById: vi.fn(),
  query: vi.fn(),
  end: vi.fn(),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      admin: {
        createUser: mocks.createUser,
        updateUserById: mocks.updateUserById,
      },
    },
  }),
}))

vi.mock('postgres', () => ({
  default: () => Object.assign(mocks.query, { end: mocks.end }),
}))

describe('provisionTestUsers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.SUPABASE_URL = 'http://127.0.0.1:54321'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role'
    process.env.DATABASE_URL = 'postgresql://postgres@127.0.0.1:54322/postgres'
    delete process.env.E2E_RESET_USERS
    // Every user already exists, which is the state a repeat run finds.
    mocks.createUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'already registered' },
    })
    mocks.query.mockResolvedValue([{ id: 'existing-user-id' }])
    mocks.end.mockResolvedValue(undefined)
  })

  afterEach(() => {
    delete process.env.E2E_RESET_USERS
  })

  it('never rewrites an existing user, because that drops its live sessions', async () => {
    await provisionTestUsers()

    expect(mocks.createUser).toHaveBeenCalled()
    expect(mocks.updateUserById).not.toHaveBeenCalled()
  })

  it('rewrites one only when asked to, for a password that has drifted', async () => {
    process.env.E2E_RESET_USERS = '1'
    mocks.updateUserById.mockResolvedValue({ error: null })

    await provisionTestUsers()

    expect(mocks.updateUserById).toHaveBeenCalledWith(
      'existing-user-id',
      expect.objectContaining({ email_confirm: true }),
    )
  })
})
