import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { Brand } from '#/components/brand'

describe('Brand', () => {
  it('renders the WT Records wordmark', () => {
    // The accent middot splits the wordmark across elements; match textContent.
    const { container } = render(<Brand />)
    expect(container.textContent).toBe('WT·RECORDS')
  })
})
