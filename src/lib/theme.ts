export type Theme = 'dark' | 'light'
export type ThemePreference = Theme | 'system'

const KEY = 'theme'

export function readThemePreference(): ThemePreference {
  try {
    const v = window.localStorage.getItem(KEY)
    return v === 'dark' || v === 'light' ? v : 'system'
  } catch {
    return 'system'
  }
}

export function writeThemePreference(pref: ThemePreference): void {
  try {
    if (pref === 'system') window.localStorage.removeItem(KEY)
    else window.localStorage.setItem(KEY, pref)
  } catch {
    /* storage unavailable — theme stays session-only */
  }
}

export function resolveTheme(
  pref: ThemePreference,
  systemPrefersLight: boolean,
): Theme {
  if (pref === 'system') return systemPrefersLight ? 'light' : 'dark'
  return pref
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme
}

/* Runs blocking in <head> so the first paint already has the right theme.
   Must stay dependency-free and mirror resolveTheme exactly. */
export const THEME_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem('theme');var t=p==='light'||p==='dark'?p:(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme='dark'}})()`
