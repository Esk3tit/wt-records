import { ConsentBanner } from 'wt-records'

export function FirstVisit() {
  return (
    <div
      className="relative overflow-hidden rounded-[26px] bg-base text-fg"
      style={{ transform: 'translateZ(0)', minHeight: '18rem' }}
    >
      <div className="p-8">
        <h1 className="text-2xl font-semibold">Ground Realistic</h1>
        <p className="mt-2 text-sm text-fg-muted">
          One record per vehicle — the highest kill count in a single match.
        </p>
      </div>
      <ConsentBanner />
    </div>
  )
}
