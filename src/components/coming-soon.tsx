export function ComingSoon({ modeName }: { modeName: string }) {
  return (
    <section className="p-8">
      <h1 className="text-2xl font-semibold">{modeName}</h1>
      <p className="mt-2 text-fg-muted">Coming soon — this mode isn’t live yet.</p>
    </section>
  )
}
