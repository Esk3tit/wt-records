import type { CountryMark } from '#/lib/country-mark-server'

/* The name always follows the mark: that labelling is the whole separation from
   the mark-only nation chips. Never an emoji flag — Chrome and Edge on Windows
   render the two regional-indicator letters instead, conformantly. */
export function PlayerCountry({ country }: { country: CountryMark }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-fg-muted">
      <svg
        viewBox={country.viewBox}
        // No inline equivalent of alt="", and SVG 2 forbids an empty <title>.
        aria-hidden="true"
        focusable="false"
        preserveAspectRatio="xMidYMid slice"
        className="country-flag"
        dangerouslySetInnerHTML={{ __html: country.body }}
      />
      {country.name}
    </span>
  )
}
