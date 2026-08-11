/* The one seam where "something is waiting" could leave the site; nothing is
   registered today. Any channel plugged in here must be push: this queue's
   defining property is that its existence is not public, and a probe route
   would leak its depth. */

/** The Review screen, for a notice to point at. */
export const REVIEW_QUEUE_PATH = '/admin/claims'

export interface AmendmentNotice {
  playerId: number
  playerDisplayName: string
  /** Where the Moderator goes to decide. Never the image itself: handing an
      unreviewed picture to a third-party CDN publishes it. */
  reviewPath: string
}

export type AmendmentNotifier = (
  notice: AmendmentNotice,
) => Promise<void> | void

const notifiers: AmendmentNotifier[] = []

/** Plug a channel in; the returned function unplugs it. */
export function registerAmendmentNotifier(
  notifier: AmendmentNotifier,
): () => void {
  notifiers.push(notifier)
  return () => {
    const at = notifiers.indexOf(notifier)
    if (at >= 0) notifiers.splice(at, 1)
  }
}

/** Fire-and-forget, errors swallowed: a submission must never block on a ping
    or fail for one, and a dropped notice costs nothing — the badge still
    shows the item. */
export function notifyAmendmentSubmitted(notice: AmendmentNotice): void {
  for (const notify of notifiers) {
    try {
      void Promise.resolve(notify(notice)).catch(() => undefined)
    } catch {
      // A notifier that throws before it returns is still not the upload's.
    }
  }
}
