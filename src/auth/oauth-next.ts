// Where to land after the OAuth round trip — stashed at /auth/login, read and
// cleared at /auth/callback. SameSite=Lax so it survives the return from the
// provider; short-lived because it only bridges one sign-in.
export const OAUTH_NEXT_COOKIE = 'wt-auth-next'
export const OAUTH_NEXT_MAX_AGE = 600
