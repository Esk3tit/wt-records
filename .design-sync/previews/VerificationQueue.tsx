import { VerificationQueue } from 'wt-records'
import { Hall } from './hall'

export function QueueStatus() {
  return (
    <Hall width="26rem">
      <VerificationQueue
        queue={{ pending: 4, verifiedThisWeek: 10, medianReviewSecs: 10800 }}
      />
    </Hall>
  )
}

export function QuietWeek() {
  return (
    <Hall width="26rem">
      <VerificationQueue
        queue={{ pending: 0, verifiedThisWeek: 0, medianReviewSecs: null }}
      />
    </Hall>
  )
}
