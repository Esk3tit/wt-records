import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Brand } from '#/components/brand'

describe('Brand', () => {
  it('renders the WT Records wordmark', () => {
    render(<Brand />)
    expect(screen.getByText(/WT.RECORDS/)).toBeDefined()
  })
})
