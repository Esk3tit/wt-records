/** Whether a server-rendered image had already failed by the time React
    reached it — that one never fires an `error` at the handler, so a ref has
    to ask. */
export function alreadyBroken(node: HTMLImageElement | null): boolean {
  return node != null && node.complete && node.naturalWidth === 0
}
