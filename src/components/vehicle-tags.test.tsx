import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { VehicleTags } from './vehicle-tags'
import type { VehicleTagFlags } from './vehicle-tags'

const treeOnly: VehicleTagFlags = {
  isEvent: false,
  isPremium: false,
  isSquadron: false,
  isRemoved: false,
}

describe('VehicleTags', () => {
  it('renders a chip for an event vehicle', () => {
    const { getByText } = render(
      <VehicleTags tags={{ ...treeOnly, isEvent: true }} />,
    )
    expect(getByText('event')).toBeDefined()
  })

  it('stacks every applicable chip when flags overlap', () => {
    const { getByText, queryByText } = render(
      <VehicleTags tags={{ ...treeOnly, isEvent: true, isPremium: true }} />,
    )
    expect(getByText('event')).toBeDefined()
    expect(getByText('premium')).toBeDefined()
    expect(queryByText('squadron')).toBeNull()
  })

  it('renders nothing for a tech-tree vehicle', () => {
    const { container } = render(<VehicleTags tags={treeOnly} />)
    expect(container.textContent).toBe('')
  })

  it('keeps the removed tag independent of acquisition', () => {
    const { getByText } = render(
      <VehicleTags tags={{ ...treeOnly, isEvent: true, isRemoved: true }} />,
    )
    expect(getByText('event')).toBeDefined()
    expect(getByText('removed')).toBeDefined()
  })
})
