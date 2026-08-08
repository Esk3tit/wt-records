import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'

const setMyCountry = vi.fn()
const invalidate = vi.fn(() => Promise.resolve())

vi.mock('#/claims/api', () => ({
  setMyCountry: (...args: Array<unknown>) => setMyCountry(...args),
}))
vi.mock('@tanstack/react-router', () => ({ useRouter: () => ({ invalidate }) }))

const { OwnerCountryControls } = await import('./owner-country-controls')

/** Resolves only when told to, so a slow earlier write can be made to land
    after a faster later one — the ordering this component has to survive. */
function deferred() {
  let release!: () => void
  const promise = new Promise<void>((r) => (release = r))
  return { promise, release }
}

const picker = () => screen.getByLabelText<HTMLSelectElement>('Country')
const status = () => screen.getByRole('status').textContent

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  setMyCountry.mockReset().mockResolvedValue(undefined)
  invalidate.mockClear()
})
afterEach(() => {
  vi.useRealTimers()
})

async function settle() {
  await act(async () => {
    vi.runAllTimers()
    await Promise.resolve()
  })
}

describe('the settle before a write', () => {
  it('writes once for a run of type-ahead keystrokes, with the last value', async () => {
    render(<OwnerCountryControls playerId={1} countryCode={null} />)

    // What typing "Jap" does to a closed native select.
    fireEvent.change(picker(), { target: { value: 'JM' } })
    fireEvent.change(picker(), { target: { value: 'JP' } })
    await settle()

    expect(setMyCountry).toHaveBeenCalledTimes(1)
    expect(setMyCountry).toHaveBeenCalledWith({
      data: { playerId: 1, countryCode: 'JP' },
    })
  })

  it('writes on blur rather than making the owner wait it out', async () => {
    render(<OwnerCountryControls playerId={1} countryCode={null} />)

    fireEvent.change(picker(), { target: { value: 'BR' } })
    // Before any re-render could carry the pick into state.
    fireEvent.blur(picker())
    await settle()

    expect(setMyCountry).toHaveBeenCalledWith({
      data: { playerId: 1, countryCode: 'BR' },
    })
  })

  it('sends null to clear, never an empty string', async () => {
    render(<OwnerCountryControls playerId={1} countryCode={'JP'} />)

    fireEvent.change(picker(), { target: { value: '' } })
    await settle()

    expect(setMyCountry).toHaveBeenCalledWith({
      data: { playerId: 1, countryCode: null },
    })
  })
})

describe('two picks racing', () => {
  it('never lets a slow earlier write land after a newer one', async () => {
    const first = deferred()
    setMyCountry
      .mockImplementationOnce(() => first.promise)
      .mockResolvedValue(undefined)

    render(<OwnerCountryControls playerId={1} countryCode={null} />)

    fireEvent.change(picker(), { target: { value: 'BR' } })
    await settle()
    expect(setMyCountry).toHaveBeenCalledTimes(1)

    // Picked again while the first write is still in flight.
    fireEvent.change(picker(), { target: { value: 'JP' } })
    await settle()
    // The second must not have been sent yet — writes are chained, so the
    // server can never receive them out of order.
    expect(setMyCountry).toHaveBeenCalledTimes(1)

    await act(async () => {
      first.release()
      await Promise.resolve()
    })
    await settle()

    expect(setMyCountry).toHaveBeenCalledTimes(2)
    expect(setMyCountry).toHaveBeenLastCalledWith({
      data: { playerId: 1, countryCode: 'JP' },
    })
  })

  it('lets only the newest write report, so "Saved" never confirms a stale pick', async () => {
    const first = deferred()
    setMyCountry
      .mockImplementationOnce(() => first.promise)
      .mockResolvedValue(undefined)

    render(<OwnerCountryControls playerId={1} countryCode={null} />)
    fireEvent.change(picker(), { target: { value: 'BR' } })
    await settle()
    fireEvent.change(picker(), { target: { value: 'JP' } })
    await settle()

    await act(async () => {
      first.release()
      await Promise.resolve()
    })
    await settle()

    // Two writes, one reload: the superseded one returned without touching the
    // route or claiming success, so "Saved" can only mean the newest pick.
    expect(setMyCountry).toHaveBeenCalledTimes(2)
    expect(invalidate).toHaveBeenCalledTimes(1)
    expect(status()).toBe('Saved')
  })
})

describe('a refused write', () => {
  it('reports it and snaps the field back to what the server still holds', async () => {
    setMyCountry.mockRejectedValue(new Error('You do not hold this claim'))
    render(<OwnerCountryControls playerId={1} countryCode={'JP'} />)

    fireEvent.change(picker(), { target: { value: 'BR' } })
    await settle()

    expect(screen.getByRole('alert').textContent).toContain(
      'You do not hold this claim',
    )
    expect(picker().value).toBe('JP')
    expect(status()).toBe('')
  })
})
