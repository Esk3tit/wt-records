import type { ReactNode } from 'react'

export function FaultPane({
  docTitle,
  eyebrow,
  numeral,
  heading,
  body,
  detail,
  actions,
}: {
  docTitle: string
  eyebrow: string
  numeral?: string
  heading: string
  body: string
  detail?: ReactNode
  actions: ReactNode
}) {
  return (
    <section className="flex justify-center pt-[10vh] pb-16 sm:pt-[14vh]">
      <title>{docTitle}</title>
      <div className="glass-mid w-full max-w-[30rem] px-6 py-10 text-center sm:px-10">
        <p className="text-[0.6875rem] font-semibold tracking-[0.2em] text-fg-muted uppercase">
          {eyebrow}
        </p>
        {numeral && (
          <p
            aria-hidden="true"
            className="mt-4 text-[clamp(3.5rem,10vw,4.5rem)] leading-none font-bold tracking-[-0.03em]"
          >
            {numeral}
          </p>
        )}
        <h1 className={`${numeral ? 'mt-3' : 'mt-4'} text-2xl font-semibold`}>
          {heading}
        </h1>
        <p className="mx-auto mt-2 max-w-[24rem] text-[0.9375rem] text-fg-muted">
          {body}
        </p>
        {detail}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {actions}
        </div>
      </div>
    </section>
  )
}
