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

/** Only the OAuth providers' own avatar CDNs may be mirrored — the seed fetch
    is server-side, so an off-host URL would be an SSRF vector. */
export function isAllowedAvatarHost(hostname: string): boolean {
  return (
    hostname === 'cdn.discordapp.com' ||
    hostname === 'googleusercontent.com' ||
    hostname.endsWith('.googleusercontent.com')
  )
}

/** The login provider's profile picture, for the one-time avatar seed choice.
    Read from the provider-set identity data — NEVER user_metadata, which an
    authenticated user can rewrite to point the server-side seed fetch anywhere
    (SSRF). https + provider-CDN host only. */
export function providerAvatarUrl(user: {
  identities?: { identity_data?: Record<string, unknown> | null }[] | null
}): string | null {
  const candidate = firstString(
    ...(user.identities ?? []).flatMap((i) => {
      const data = i.identity_data ?? {}
      return [data.avatar_url, data.picture]
    }),
  )
  if (!candidate) return null
  try {
    const url = new URL(candidate)
    if (url.protocol !== 'https:') return null
    return isAllowedAvatarHost(url.hostname) ? candidate : null
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
