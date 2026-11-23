export type ReacquireAction = 'retry' | 'reload' | 'none'

/**
 * После возврата lease:
 * - ревизия не изменилась — можно безопасно повторить отправку грязной очереди;
 * - ревизия изменилась — старые поля отправлять нельзя, нужно перечитать
 *   серверный снимок и предложить архивный черновик;
 * - нечего сохранять — достаточно перечитать снимок, если он устарел.
 */
export function planLeaseReacquire({
  dirty,
  currentRevision,
  freshRevision,
}: {
  dirty: boolean
  currentRevision: number
  freshRevision: number
}): ReacquireAction {
  if (freshRevision !== currentRevision) return 'reload'
  return dirty ? 'retry' : 'none'
}
