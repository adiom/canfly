export type ReacquireAction = 'retry' | 'reload' | 'blocked' | 'none'

/**
 * После возврата lease:
 * - ревизия не изменилась — можно безопасно повторить отправку грязной очереди;
 * - ревизия изменилась и черновик надёжно сохранён — перечитать серверный снимок;
 * - ревизия изменилась, но сохранить черновик не удалось — нельзя сбрасывать
 *   редактор: показываем блокировку и предлагаем скопировать текст;
 * - сохранять нечего — перечитываем снимок только при смене ревизии.
 */
export function planLeaseReacquire({
  dirty,
  currentRevision,
  freshRevision,
  archived = true,
}: {
  dirty: boolean
  currentRevision: number
  freshRevision: number
  archived?: boolean
}): ReacquireAction {
  if (freshRevision !== currentRevision) {
    return dirty && !archived ? 'blocked' : 'reload'
  }
  return dirty ? 'retry' : 'none'
}
