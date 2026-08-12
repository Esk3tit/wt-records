import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'

const setMyLink = vi.fn()
const removeMyLink = vi.fn()
const invalidate = vi.fn(() => Promise.resolve())

vi.mock('#/claims/api', () => ({
  setMyLink: (...args: Array<unknown>) => setMyLink(...args),
  removeMyLink: (...args: Array<unknown>) => removeMyLink(...args),
}))
vi.mock('@tanstack/react-router', () => ({ useRouter: () => ({ invalidate }) }))

const { OwnerLinkControls } = await import('./owner-link-controls')

const field = (name: string) =>
  screen.getByLabelText<HTMLInputElement>(new RegExp(`^${name} — `))
const saveButton = (name: string) =>
  screen.getByRole<HTMLButtonElement>('button', { name: `Save ${name} link` })
const liveRegions = () =>
  screen.getAllByRole('status').map((el) => el.textContent)

const flush = () => act(async () => undefined)

beforeEach(() => {
  setMyLink.mockReset().mockResolvedValue({ handle: 'PhlyDaily' })
  removeMyLink.mockReset().mockResolvedValue(undefined)
  invalidate.mockClear()
})

/* The editor publishes instantly, so what it owes its owner is certainty about
   what a visitor will get. That is two different jobs — a preview that changes
   under the cursor, and a confirmation worth interrupting for — and they must
   not share an element. */
describe('the constructed URL, shown as it is typed', () => {
  it('renders outside every live region, so it is not read out per keystroke', async () => {
    render(
      <OwnerLinkControls
        playerId={1}
        links={[{ platform: 'youtube', handle: 'PhlyDaily' }]}
      />,
    )
    fireEvent.change(field('YouTube'), { target: { value: 'SomeoneElse' } })
    await flush()

    expect(
      screen.getByText('https://www.youtube.com/@SomeoneElse'),
    ).toBeTruthy()
    // The whole point: a reader hearing the URL re-announced on every character
    // is why this was split out of the status element.
    for (const region of liveRegions()) {
      expect(region).not.toMatch(/youtube\.com/)
    }
  })

  it('still announces the one thing worth interrupting for', async () => {
    render(
      <OwnerLinkControls
        playerId={1}
        links={[{ platform: 'youtube', handle: 'PhlyDaily' }]}
      />,
    )
    fireEvent.change(field('YouTube'), { target: { value: 'SomeoneElse' } })
    fireEvent.click(saveButton('YouTube'))
    await flush()

    expect(liveRegions()).toContain('Saved')
  })

  it('says nothing before a save, and stops saying it on the next edit', async () => {
    render(
      <OwnerLinkControls
        playerId={1}
        links={[{ platform: 'youtube', handle: 'PhlyDaily' }]}
      />,
    )
    expect(liveRegions().join('')).toBe('')

    fireEvent.change(field('YouTube'), { target: { value: 'SomeoneElse' } })
    fireEvent.click(saveButton('YouTube'))
    await flush()
    expect(liveRegions()).toContain('Saved')

    fireEvent.change(field('YouTube'), { target: { value: 'AndAnother' } })
    await flush()
    expect(liveRegions().join('')).toBe('')
  })
})

/* "Echo back exactly what was stored" is the field's whole promise, and it is
   the server's answer that settles it — not the text that was typed. */
describe('what the field settles on', () => {
  it('takes the handle the server actually stored', async () => {
    setMyLink.mockResolvedValue({ handle: 'PhlyDaily' })
    render(<OwnerLinkControls playerId={1} links={[]} />)

    fireEvent.change(field('YouTube'), { target: { value: '  @PhlyDaily  ' } })
    fireEvent.click(saveButton('YouTube'))
    await flush()

    expect(field('YouTube').value).toBe('PhlyDaily')
    // Nothing left to save, so the button has nothing to offer.
    expect(saveButton('YouTube').disabled).toBe(true)
  })

  // The personal site stores a whole canonical URL under a prefix that already
  // draws the scheme, so the raw value in the field would read `https://https://`.
  it('strips the welded scheme from a stored personal site', async () => {
    render(
      <OwnerLinkControls
        playerId={1}
        links={[{ platform: 'website', handle: 'https://phlydaily.example' }]}
      />,
    )
    expect(field('Personal site').value).toBe('phlydaily.example')
    expect(saveButton('Personal site').disabled).toBe(true)
  })

  it('keeps an unsaved edit in the field when the write is refused', async () => {
    setMyLink.mockRejectedValue(
      new Error('Another player already shows that handle.'),
    )
    render(<OwnerLinkControls playerId={1} links={[]} />)

    fireEvent.change(field('YouTube'), { target: { value: 'Taken' } })
    fireEvent.click(saveButton('YouTube'))
    await flush()

    expect(field('YouTube').value).toBe('Taken')
    expect(screen.getByRole('alert').textContent).toMatch(/already shows/)
  })
})
