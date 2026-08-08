import type { CountryMark } from '#/lib/country-mark'

/* A claimed Player's stated Country. The mark never appears alone — the full
   name always follows it as text, and that labelling is the entire separation
   from the in-game nation chips, which are mark-only with sr-only names. Never
   an emoji flag: Chrome and Edge on Windows render the two regional-indicator
   letters instead, conformantly and unfixably. Links nowhere. */
export function PlayerCountry({ country }: { country: CountryMark }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-fg-muted">
      <svg
        viewBox={country.viewBox}
        // SVG 2 forbids an empty <title> and inline SVG has no alt="", so the
        // mark is hidden outright — the name beside it is already the label.
        aria-hidden="true"
        focusable="false"
        preserveAspectRatio="xMidYMid slice"
        className="country-flag"
        dangerouslySetInnerHTML={{ __html: country.flag }}
      />
      {country.name}
    </span>
  )
}
