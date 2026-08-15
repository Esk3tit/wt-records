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
/* Every region a reader would be interrupted by, not just the one this
   component happens to use today — the claim under test is that the preview is
   outside ALL of them, and a helper that only knows `role="status"` would go on
   passing if a later change moved it into an `aria-live` element or an alert. */
const liveRegions = () =>
  Array.from(
    document.querySelectorAll<HTMLElement>(
      '[aria-live], [role="status"], [role="alert"], [role="log"]',
    ),
  ).map((el) => el.textContent)

const flush = () => act(async () => undefined)

/** An owner with no links meets the rail's own affordance rather than a form —
    the empty rail is the only moment this feature is mentioned to them. The
    fields are what it opens onto, so a case about the fields opens it first. */
const renderWithNoLinks = () => {
  const view = render(<OwnerLinkControls playerId={1} links={[]} />)
  fireEvent.click(screen.getByRole('button', { name: 'Add links' }))
  return view
}

beforeEach(() => {
  setMyLink.mockReset().mockResolvedValue({ handle: 'PhlyDaily' })
  removeMyLink.mockReset().mockResolvedValue(undefined)
  invalidate.mockReset().mockResolvedValue(undefined)
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

/* An owner with no links has no rail, so there is nowhere else this feature is
   ever mentioned to the one person who can use it. The empty state became the
   moment — which only works if it is a moment and not a form. */
describe('the empty rail', () => {
  it('offers the affordance and nothing else', () => {
    render(<OwnerLinkControls playerId={1} links={[]} />)

    expect(screen.getByRole('button', { name: 'Add links' })).toBeTruthy()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.queryByRole('combobox')).toBeNull()
  })

  it('opens onto the fields when it is asked to', () => {
    renderWithNoLinks()

    expect(field('YouTube')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Add links' })).toBeNull()
  })

  /* Held links are already a rail, and the fields beneath it are then editing
     something rather than teaching that the feature exists. */
  it('is not what an owner who already has links meets', () => {
    render(
      <OwnerLinkControls
        playerId={1}
        links={[{ platform: 'youtube', handle: 'PhlyDaily' }]}
      />,
    )

    expect(screen.queryByRole('button', { name: 'Add links' })).toBeNull()
    expect(field('YouTube').value).toBe('PhlyDaily')
  })
})

/* "Echo back exactly what was stored" is the field's whole promise, and it is
   the server's answer that settles it — not the text that was typed. */
describe('what the field settles on', () => {
  it('takes the handle the server actually stored', async () => {
    setMyLink.mockResolvedValue({ handle: 'PhlyDaily' })
    renderWithNoLinks()

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
    renderWithNoLinks()

    fireEvent.change(field('YouTube'), { target: { value: 'Taken' } })
    fireEvent.click(saveButton('YouTube'))
    await flush()

    expect(field('YouTube').value).toBe('Taken')
    expect(screen.getByRole('alert').textContent).toMatch(/already shows/)
  })
})

/* The reload after a write is allowed to fail (`router.invalidate()` is called
   with `.catch(() => undefined)`), and when it does the props never catch up.
   Modelled here by the parent simply never re-rendering, which is the same
   thing from the control's side: it has to describe what the server confirmed
   rather than what it was last handed. */
describe('when the parent’s props have not caught up', () => {
  it('stops offering Remove for a link that is already gone', async () => {
    render(
      <OwnerLinkControls
        playerId={1}
        links={[{ platform: 'youtube', handle: 'PhlyDaily' }]}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Remove YouTube link' }))
    await flush()

    expect(removeMyLink).toHaveBeenCalledTimes(1)
    expect(
      screen.queryByRole('button', { name: 'Remove YouTube link' }),
    ).toBeNull()
    expect(field('YouTube').value).toBe('')
  })

  it('offers Remove for a link just added, without waiting for a reload', async () => {
    setMyLink.mockResolvedValue({ handle: 'PhlyDaily' })
    renderWithNoLinks()

    fireEvent.change(field('YouTube'), { target: { value: 'PhlyDaily' } })
    fireEvent.click(saveButton('YouTube'))
    await flush()

    // Without this the owner has published something they cannot take down
    // until they reload the page themselves.
    expect(
      screen.getByRole('button', { name: 'Remove YouTube link' }),
    ).toBeTruthy()
  })
})
