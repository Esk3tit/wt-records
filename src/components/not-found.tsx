import { Link } from '@tanstack/react-router'
import { FaultPane } from '#/components/fault-pane'

export function NotFoundPage() {
  return (
    <FaultPane
      docTitle="Page not found — WT Records"
      eyebrow="Not in the registry"
      numeral="404"
      heading="Nothing is hangared here."
      body="No page answers this address — the link may be mistyped, or what it pointed at may have moved on."
      actions={
        <>
          <Link to="/search" className="glass-pill no-underline">
            Search the registry
          </Link>
          <Link to="/" className="glass-pill no-underline">
            Back to the records
          </Link>
        </>
      }
    />
  )
}
