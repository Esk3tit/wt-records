import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import {
  applyTheme,
  readThemePreference,
  resolveTheme,
  writeThemePreference,
} from '#/lib/theme'
import type { Theme } from '#/lib/theme'

/* Renders only after mount: the resolved theme lives in localStorage +
   matchMedia, so the server can't know which icon is correct. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null)

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: light)')
    setTheme(resolveTheme(readThemePreference(), media.matches))
    const onSystemChange = (e: MediaQueryListEvent) => {
      if (readThemePreference() !== 'system') return
      const next = e.matches ? 'light' : 'dark'
      applyTheme(next)
      setTheme(next)
    }
    media.addEventListener('change', onSystemChange)
    return () => media.removeEventListener('change', onSystemChange)
  }, [])

  if (!theme) return null

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    writeThemePreference(next)
    applyTheme(next)
    setTheme(next)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={
        theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
      }
      className="rounded-[10px] p-2 text-fg-muted transition-colors duration-200 hover:text-fg"
    >
      {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  )
}
