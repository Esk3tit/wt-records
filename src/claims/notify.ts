/* The one seam where "something is waiting" could leave the site. Nothing is
   registered today — the badge on the Review tab is the whole notification —
   and this exists so the eventual channel plugs in without the submit path
   learning anything about it.

   Deliberately not a probe: a public status route would leak the queue's depth,
   and on a site this small a count going 0→1 is inferable by the one person who
   just uploaded. The queue's defining property is that its existence is not
   public, so any channel here must be push. */

/** The Review screen, for a notice to point at. */
export const REVIEW_QUEUE_PATH = '/admin/claims'

export interface AmendmentNotice {
  playerId: number
  playerDisplayName: string
  /** Where the Moderator goes to decide. Never the image itself: the picture
      is unreviewed, and handing it to a third-party CDN publishes it. */
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

/** Fire-and-forget, and errors swallowed: a submission must never block on a
    ping or fail for one. A dropped notice costs nothing, because the badge
    still shows the item. */
export function notifyAmendmentSubmitted(notice: AmendmentNotice): void {
  for (const notify of notifiers) {
    try {
      void Promise.resolve(notify(notice)).catch(() => undefined)
    } catch {
      // A notifier that throws before it returns is still not the upload's.
    }
  }
}
