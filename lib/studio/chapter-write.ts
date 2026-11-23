export const chapterWriteMessages = {
  conflict: 'Глава изменилась после открытия. Скопируйте свои правки перед перезагрузкой.',
  'not-found': 'Глава удалена или недоступна.',
  'version-not-found': 'Версия главы не найдена.',
  validation: 'Проверьте данные главы.',
}

export type ChapterWriteCode = keyof typeof chapterWriteMessages

export type ChapterWriteFailure = { ok: false; code: ChapterWriteCode; message: string }
export type ChapterWriteResult<T> = { ok: true; value: T } | ChapterWriteFailure

export class ChapterWriteError extends Error {
  constructor(readonly code: ChapterWriteCode) {
    super(chapterWriteMessages[code])
  }
}
