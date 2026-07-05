import { SectionHead } from 'wt-records'
import { Hall } from './hall'

export function WithAside() {
  return (
    <Hall width="36rem">
      <SectionHead title="The podium" aside="all-time · top five" />
    </Hall>
  )
}

export function TitleOnly() {
  return (
    <Hall width="36rem">
      <SectionHead title="Nation completion" />
    </Hall>
  )
}
