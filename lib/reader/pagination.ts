export function lastPageStart(pageCount: number, isSpread: boolean): number {
  const last = Math.max(0, pageCount - 1)
  return isSpread ? Math.floor(last / 2) * 2 : last
}

export function clampPage(page: number, pageCount: number, isSpread: boolean): number {
  const clamped = Math.max(0, Math.min(page, lastPageStart(pageCount, isSpread)))
  return isSpread ? Math.floor(clamped / 2) * 2 : clamped
}

export function chapterProgress(page: number, pageCount: number, isSpread: boolean): number {
  if (pageCount <= 1) return 1
  const lastVisible = Math.min(pageCount - 1, page + (isSpread ? 1 : 0))
  return Math.max(0, lastVisible / (pageCount - 1))
}
