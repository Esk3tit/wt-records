import { describe, expect, it } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { VehicleIcon } from './vehicle-icon'
import { PlayerAvatar } from './player-avatar'

describe('VehicleIcon', () => {
  it('keeps the slot but hides art whose object has gone', () => {
    const { container } = render(
      <VehicleIcon src="https://assets.example/gone.png" variant="ledger" />,
    )
    const img = container.querySelector('img')!
    expect(img.style.visibility).toBe('')
    fireEvent.error(img)
    expect(container.querySelector('img')!.style.visibility).toBe('hidden')
  })

  it('shows a corrected image rather than inheriting the old failure', () => {
    const { container, rerender } = render(
      <VehicleIcon src="https://assets.example/gone.png" variant="ledger" />,
    )
    fireEvent.error(container.querySelector('img')!)
    rerender(
      <VehicleIcon src="https://assets.example/fixed.png" variant="ledger" />,
    )
    expect(container.querySelector('img')!.style.visibility).toBe('')
  })
})

describe('PlayerAvatar', () => {
  it('falls back to the Medallion when the avatar object has gone', () => {
    const { container } = render(
      <PlayerAvatar
        avatarUrl="https://assets.example/gone.png"
        displayName="Koalkiest"
      />,
    )
    fireEvent.error(container.querySelector('img')!)
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('svg[role="img"]')).toBeTruthy()
  })

  it('tries a replacement avatar rather than staying on the Medallion', () => {
    const { container, rerender } = render(
      <PlayerAvatar
        avatarUrl="https://assets.example/gone.png"
        displayName="Koalkiest"
      />,
    )
    fireEvent.error(container.querySelector('img')!)
    rerender(
      <PlayerAvatar
        avatarUrl="https://assets.example/new.png"
        displayName="Koalkiest"
      />,
    )
    expect(container.querySelector('img')?.getAttribute('src')).toContain(
      'new.png',
    )
  })
})
