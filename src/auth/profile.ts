import { eq, sql } from 'drizzle-orm'
import type { Db } from '#/db'
import { profiles } from '#/db/schema'

export interface OAuthProfile {
  id: string
  handle: string | null
  discordId: string | null
}

/** Discord identity fields from a Supabase user, defensively — metadata shape
    varies across provider config versions. */
export function profileFromUser(user: {
  id: string
  user_metadata?: Record<string, unknown>
  identities?: { provider: string; id: string }[] | null
}): OAuthProfile {
  const meta = user.user_metadata ?? {}
  const claims = meta.custom_claims as Record<string, unknown> | undefined
  const handle =
    firstString(claims?.global_name, meta.full_name, meta.name) ?? null
  const discordId =
    firstString(meta.provider_id, meta.sub) ??
    user.identities?.find((i) => i.provider === 'discord')?.id ??
    null
  return { id: user.id, handle, discordId }
}

function firstString(...values: unknown[]): string | undefined {
  return values.find(
    (v): v is string => typeof v === 'string' && v.trim() !== '',
  )
}

/** The login provider's profile picture, for the one-time avatar seed choice.
    https only — the seed fetch must never reach a plaintext or non-URL value. */
export function providerAvatarUrl(user: {
  user_metadata?: Record<string, unknown>
}): string | null {
  const meta = user.user_metadata ?? {}
  const candidate = firstString(meta.avatar_url, meta.picture)
  if (!candidate) return null
  try {
    return new URL(candidate).protocol === 'https:' ? candidate : null
  } catch {
    return null
  }
}

/** Provisions the profile on every OAuth callback. Refreshes identity fields,
    NEVER touches role — mods are promoted by one-off SQL and must stay mods. */
export async function upsertProfileFromOAuth(
  db: Db,
  profile: OAuthProfile,
): Promise<void> {
  await db
    .insert(profiles)
    .values({
      id: profile.id,
      handle: profile.handle,
      discordId: profile.discordId,
    })
    .onConflictDoUpdate({
      target: profiles.id,
      set: {
        handle: sql`coalesce(${profile.handle}, ${profiles.handle})`,
        discordId: sql`coalesce(${profile.discordId}, ${profiles.discordId})`,
      },
    })
}

export async function getProfileRole(
  db: Db,
  userId: string,
): Promise<{
  role: 'viewer' | 'moderator' | 'admin'
  handle: string | null
} | null> {
  const row = (
    await db
      .select({ role: profiles.role, handle: profiles.handle })
      .from(profiles)
      .where(eq(profiles.id, userId))
  ).at(0)
  return row ?? null
}
