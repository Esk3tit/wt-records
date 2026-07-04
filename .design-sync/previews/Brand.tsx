import { Brand } from 'wt-records'
import type { ReactNode } from 'react'

function Hall({ children }: { children: ReactNode }) {
  return <div className="rounded-[26px] bg-base p-8 text-fg">{children}</div>
}

export function HeroScale() {
  return (
    <Hall>
      <h1 className="text-4xl">
        <Brand />
      </h1>
    </Hall>
  )
}

export function NavScale() {
  return (
    <Hall>
      <p className="text-[0.9375rem]">
        <Brand />
      </p>
    </Hall>
  )
}
