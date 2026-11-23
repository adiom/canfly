export const chapterWriteMessages = {
  conflict: 'Глава изменилась после открытия. Скопируйте свои правки перед перезагрузкой.',
  'not-found': 'Глава удалена или недоступна.',
  'version-not-found': 'Версия главы не найдена.',
  validation: 'Проверьте данные главы.',
  'lease-required': 'Право редактирования не подтверждено. Обновите страницу.',
  'lease-held': 'Глава уже редактируется в другой сессии. Открыт режим чтения.',
  'lease-lost': 'Право редактирования потеряно. Ваши правки сохранены локально.',
}

export type ChapterWriteCode = keyof typeof chapterWriteMessages

export type ChapterWriteFailure = { ok: false; code: ChapterWriteCode; message: string }
export type ChapterWriteResult<T> = { ok: true; value: T } | ChapterWriteFailure

export class ChapterWriteError extends Error {
  constructor(readonly code: ChapterWriteCode) {
    super(chapterWriteMessages[code])
  }
}
