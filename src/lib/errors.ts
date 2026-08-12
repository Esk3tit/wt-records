const GENERIC = 'Something went wrong'

/** A user-facing message for a caught error, defaulting to a safe generic.

    A database driver puts the SQL it could not run into `message`, so anything
    shaped like one is replaced: nobody can act on a query, and a visitor is
    owed no schema. Everything the app threw on purpose passes through. */
export function errorMessage(error: unknown): string {
  if (!(error instanceof Error)) return GENERIC
  return fromTheDriver(error) ? GENERIC : error.message
}

/* Drizzle prefixes the statement it failed on; postgres-js carries a
   five-character SQLSTATE. Only the prefix survives serialization from a
   server function, which is why it is not the only thing checked. */
function fromTheDriver(error: Error): boolean {
  const code = (error as { code?: unknown }).code
  return (
    error.message.startsWith('Failed query') ||
    (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code))
  )
}
