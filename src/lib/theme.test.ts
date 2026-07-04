import { beforeEach, describe, expect, it } from 'vitest'
import {
  applyTheme,
  readThemePreference,
  resolveTheme,
  writeThemePreference,
} from '#/lib/theme'

beforeEach(() => {
  window.localStorage.clear()
  delete document.documentElement.dataset.theme
})

describe('theme preference', () => {
  it('defaults to system when nothing is stored', () => {
    expect(readThemePreference()).toBe('system')
  })

  it('round-trips an explicit preference', () => {
    writeThemePreference('light')
    expect(readThemePreference()).toBe('light')
    writeThemePreference('dark')
    expect(readThemePreference()).toBe('dark')
  })

  it('clears the stored value when set back to system', () => {
    writeThemePreference('light')
    writeThemePreference('system')
    expect(window.localStorage.getItem('theme')).toBeNull()
    expect(readThemePreference()).toBe('system')
  })

  it('treats a corrupted stored value as system', () => {
    window.localStorage.setItem('theme', 'neon')
    expect(readThemePreference()).toBe('system')
  })
})

describe('resolveTheme', () => {
  it('follows the system when unset, explicit preference otherwise', () => {
    expect(resolveTheme('system', true)).toBe('light')
    expect(resolveTheme('system', false)).toBe('dark')
    expect(resolveTheme('dark', true)).toBe('dark')
    expect(resolveTheme('light', false)).toBe('light')
  })
})

describe('applyTheme', () => {
  it('stamps the resolved theme on the document root', () => {
    applyTheme('light')
    expect(document.documentElement.dataset.theme).toBe('light')
  })
})
