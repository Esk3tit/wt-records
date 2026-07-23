/** A user-facing message for a caught error, defaulting to a safe generic. */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong'
}
