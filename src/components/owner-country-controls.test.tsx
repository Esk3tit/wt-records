import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'

const setMyCountry = vi.fn()
const invalidate = vi.fn(() => Promise.resolve())

vi.mock('#/claims/api', () => ({
  setMyCountry: (...args: Array<unknown>) => setMyCountry(...args),
}))
vi.mock('@tanstack/react-router', () => ({ useRouter: () => ({ invalidate }) }))

const { OwnerCountryControls } = await import('./owner-country-controls')

/** Resolves only when told to, so a write can be held in flight. */
function deferred() {
  let release!: () => void
  const promise = new Promise<void>((r) => (release = r))
  return { promise, release }
}

const picker = () => screen.getByLabelText<HTMLSelectElement>('Country')
const saveButton = () =>
  screen.getByRole<HTMLButtonElement>('button', { name: 'Save' })
const status = () => screen.getByRole('status').textContent
const sentCodes = () =>
  setMyCountry.mock.calls.map((c) => c[0].data.countryCode)

const flush = () => act(async () => undefined)

beforeEach(() => {
  setMyCountry.mockReset().mockResolvedValue(undefined)
  invalidate.mockClear()
})

describe('a country is written only when the owner says so', () => {
  // A closed native <select> fires `change` per type-ahead keystroke: "Japan"
  // arrives as J → Jamaica, Ja → Jamaica, Jap → Japan. None of those are picks.
  it('writes nothing for the countries type-ahead passes through', async () => {
    render(<OwnerCountryControls playerId={1} countryCode={null} />)

    fireEvent.change(picker(), { target: { value: 'JM' } })
    fireEvent.change(picker(), { target: { value: 'JP' } })
    await flush()

    expect(setMyCountry).not.toHaveBeenCalled()
  })

  // The pause is what defeats a debounce: it makes the waypoint look settled.
  it('writes nothing for a waypoint the owner rested on mid-word', async () => {
    render(<OwnerCountryControls playerId={1} countryCode={null} />)

    fireEvent.change(picker(), { target: { value: 'JM' } })
    await new Promise((r) => setTimeout(r, 50))
    await flush()
    fireEvent.change(picker(), { target: { value: 'JP' } })
    fireEvent.click(saveButton())
    await flush()

    expect(sentCodes()).toEqual(['JP'])
  })

  it('writes the chosen country once, on the press', async () => {
    render(<OwnerCountryControls playerId={1} countryCode={null} />)

    fireEvent.change(picker(), { target: { value: 'JP' } })
    fireEvent.click(saveButton())
    await flush()

    expect(setMyCountry).toHaveBeenCalledTimes(1)
    expect(setMyCountry).toHaveBeenCalledWith({
      data: { playerId: 1, countryCode: 'JP' },
    })
    expect(invalidate).toHaveBeenCalledTimes(1)
    expect(status()).toBe('Saved')
  })

  it('sends null to clear, never an empty string', async () => {
    render(<OwnerCountryControls playerId={1} countryCode="JP" />)

    fireEvent.change(picker(), { target: { value: '' } })
    fireEvent.click(saveButton())
    await flush()

    expect(sentCodes()).toEqual([null])
  })
})

describe('the Save press', () => {
  it('is offered only once the field differs from what is stored', () => {
    render(<OwnerCountryControls playerId={1} countryCode="JP" />)
    expect(saveButton().disabled).toBe(true)

    fireEvent.change(picker(), { target: { value: 'BR' } })
    expect(saveButton().disabled).toBe(false)

    // Back to the stored value is not an edit.
    fireEvent.change(picker(), { target: { value: 'JP' } })
    expect(saveButton().disabled).toBe(true)
  })

  // Two writes can never overlap, so a slow one cannot land after a newer one.
  it('cannot be pressed again while a write is going', async () => {
    const inFlight = deferred()
    setMyCountry.mockImplementationOnce(() => inFlight.promise)

    render(<OwnerCountryControls playerId={1} countryCode={null} />)
    fireEvent.change(picker(), { target: { value: 'BR' } })
    fireEvent.click(saveButton())
    await flush()

    expect(saveButton().disabled).toBe(true)
    fireEvent.click(saveButton())
    fireEvent.change(picker(), { target: { value: 'JP' } })
    fireEvent.click(saveButton())
    await flush()
    expect(setMyCountry).toHaveBeenCalledTimes(1)

    await act(async () => {
      inFlight.release()
      await Promise.resolve()
    })
    expect(sentCodes()).toEqual(['BR'])
  })

  // The press disables its own button, and a disabled control cannot hold
  // focus — the same trap that made disabling the select unusable.
  it('hands focus back to the field rather than dropping it', async () => {
    const { rerender } = render(
      <OwnerCountryControls playerId={1} countryCode={null} />,
    )
    fireEvent.change(picker(), { target: { value: 'JP' } })
    saveButton().focus()
    expect(document.activeElement).toBe(saveButton())

    fireEvent.click(saveButton())
    await flush()
    // What the reload does: the parent re-renders with what is now stored, and
    // the button disables because there is nothing left to save.
    rerender(<OwnerCountryControls playerId={1} countryCode="JP" />)

    expect(saveButton().disabled).toBe(true)
    expect(document.activeElement).toBe(picker())
  })

  // Disabling a focused control blurs it out from under the owner — the reason
  // the select is never the thing that goes quiet.
  it('never disables the select itself', async () => {
    const inFlight = deferred()
    setMyCountry.mockImplementationOnce(() => inFlight.promise)

    render(<OwnerCountryControls playerId={1} countryCode={null} />)
    fireEvent.change(picker(), { target: { value: 'BR' } })
    fireEvent.click(saveButton())
    await flush()

    expect(picker().disabled).toBe(false)
    await act(async () => {
      inFlight.release()
      await Promise.resolve()
    })
  })
})

describe('a refused write', () => {
  it('reports it and keeps the choice so the owner can press again', async () => {
    setMyCountry.mockRejectedValue(new Error('You do not hold this claim'))
    render(<OwnerCountryControls playerId={1} countryCode="JP" />)

    fireEvent.change(picker(), { target: { value: 'BR' } })
    fireEvent.click(saveButton())
    await flush()

    expect(screen.getByRole('alert').textContent).toContain(
      'You do not hold this claim',
    )
    // Not snapped back: finding the country again would be the owner's cost
    // for the server's failure.
    expect(picker().value).toBe('BR')
    expect(saveButton().disabled).toBe(false)
    expect(status()).toBe('')
    expect(invalidate).not.toHaveBeenCalled()
  })

  it('clears the error once the owner picks again', async () => {
    setMyCountry.mockRejectedValue(new Error('Network error'))
    render(<OwnerCountryControls playerId={1} countryCode={null} />)

    fireEvent.change(picker(), { target: { value: 'BR' } })
    fireEvent.click(saveButton())
    await flush()
    expect(screen.queryByRole('alert')).not.toBeNull()

    fireEvent.change(picker(), { target: { value: 'JP' } })
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('"Saved"', () => {
  // The select stays editable during the write, so the owner can move on
  // before it lands — and the status names the country in the field.
  it('is not claimed for a country the owner changed away from mid-write', async () => {
    const inFlight = deferred()
    setMyCountry.mockImplementationOnce(() => inFlight.promise)

    render(<OwnerCountryControls playerId={1} countryCode={null} />)
    fireEvent.change(picker(), { target: { value: 'BR' } })
    fireEvent.click(saveButton())
    await flush()

    // Changed while BR is still going.
    fireEvent.change(picker(), { target: { value: 'JP' } })
    await act(async () => {
      inFlight.release()
      await Promise.resolve()
    })

    // BR is what was stored, JP is what the field shows — so neither a stale
    // confirmation nor a claim about a country that was never submitted.
    expect(sentCodes()).toEqual(['BR'])
    expect(picker().value).toBe('JP')
    expect(status()).toBe('')
    expect(saveButton().disabled).toBe(false)
  })

  it('stops standing for a pick the owner has since changed', async () => {
    render(<OwnerCountryControls playerId={1} countryCode={null} />)

    fireEvent.change(picker(), { target: { value: 'JP' } })
    fireEvent.click(saveButton())
    await flush()
    expect(status()).toBe('Saved')

    fireEvent.change(picker(), { target: { value: 'BR' } })
    expect(status()).toBe('')
  })
})
