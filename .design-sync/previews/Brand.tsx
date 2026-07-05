import { Brand } from 'wt-records'
import { Hall } from './hall'

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
