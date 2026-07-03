export type ConsentState = 'unknown' | 'granted' | 'denied'

const STORAGE_KEY = 'wt-consent'

// localStorage can throw or be absent (SSR, private mode, storage disabled).
// Any failure resolves to `unknown`/no-op, which keeps analytics off — the
// privacy-safe default.
export function readConsent(): ConsentState {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value === 'granted' || value === 'denied' ? value : 'unknown'
  } catch {
    return 'unknown'
  }
}

export function writeConsent(state: 'granted' | 'denied'): void {
  try {
    localStorage.setItem(STORAGE_KEY, state)
  } catch {
    /* storage unavailable — decision simply won't persist */
  }
}
