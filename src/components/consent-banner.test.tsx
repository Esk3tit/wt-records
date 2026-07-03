import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ConsentBanner } from '#/components/consent-banner'
import { readConsent } from '#/lib/consent'

const grantConsent = vi.fn()
const revokeConsent = vi.fn()
vi.mock('#/lib/observability', () => ({
  grantConsent: () => grantConsent(),
  revokeConsent: () => revokeConsent(),
}))

afterEach(() => {
  grantConsent.mockClear()
  revokeConsent.mockClear()
})

describe('ConsentBanner', () => {
  it('shows until a decision is made', async () => {
    render(<ConsentBanner />)
    expect(await screen.findByRole('dialog')).toBeDefined()
  })

  it('stays hidden once a decision already exists', () => {
    localStorage.setItem('wt-consent', 'denied')
    render(<ConsentBanner />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('accepting grants consent, persists it, and dismisses', async () => {
    render(<ConsentBanner />)
    fireEvent.click(await screen.findByRole('button', { name: /accept/i }))
    expect(grantConsent).toHaveBeenCalledOnce()
    expect(readConsent()).toBe('granted')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('declining revokes consent, persists it, and dismisses', async () => {
    render(<ConsentBanner />)
    fireEvent.click(await screen.findByRole('button', { name: /decline/i }))
    expect(revokeConsent).toHaveBeenCalledOnce()
    expect(readConsent()).toBe('denied')
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
