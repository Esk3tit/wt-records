import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import {
  RouterProvider,
  createRootRoute,
  createRouter,
  createMemoryHistory,
} from '@tanstack/react-router'
import { RecordName } from './record-name'
import type { RecordNameProps } from './record-name'

function renderName(props: RecordNameProps) {
  const rootRoute = createRootRoute({ component: () => <RecordName {...props} /> })
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  return render(<RouterProvider router={router as never} />)
}

describe('RecordName', () => {
  it('shows only the primary name when snapshots match it', async () => {
    const { container, findByText } = renderName({
      displayName: 'Ace',
      playerSlug: 'ace',
      ignSnapshot: 'Ace',
      displayNameSnapshot: 'Ace',
    })
    await findByText('Ace')
    expect(container.textContent).toBe('Ace')
  })

  it('shows the IGN snapshot as secondary when it differs', async () => {
    const { container, findByText } = renderName({
      displayName: 'Ace',
      playerSlug: 'ace',
      ignSnapshot: 'OldIGN',
      displayNameSnapshot: 'Ace',
    })
    await findByText('Ace')
    expect(container.textContent).toContain('as «OldIGN»')
  })

  it('shows a differing display-name snapshot, not duplicating the IGN', async () => {
    const { container, findByText } = renderName({
      displayName: 'Ace',
      playerSlug: 'ace',
      ignSnapshot: 'OldIGN',
      displayNameSnapshot: 'FormerName',
    })
    await findByText('Ace')
    expect(container.textContent).toContain('as «OldIGN»')
    expect(container.textContent).toContain('formerly «FormerName»')
  })

  it('does not duplicate the secondary when both snapshots are the same', async () => {
    const { container, findByText } = renderName({
      displayName: 'Ace',
      playerSlug: 'ace',
      ignSnapshot: 'OldName',
      displayNameSnapshot: 'OldName',
    })
    await findByText('Ace')
    expect(container.textContent).toContain('as «OldName»')
    expect(container.textContent).not.toContain('formerly')
  })

  it('tolerates missing snapshots', async () => {
    const { container, findByText } = renderName({
      displayName: 'Ace',
      playerSlug: 'ace',
    })
    await findByText('Ace')
    expect(container.textContent).toBe('Ace')
  })
})
