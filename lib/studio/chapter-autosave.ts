import type { AutosaveResult } from '@/lib/studio/autosave-queue'
import type { ChapterWriteFailure, ChapterWriteResult } from '@/lib/studio/chapter-write'
import type { ChapterLeaseProof } from '@/lib/studio/chapter-lease'

export interface ChapterAutosaveInput<T extends { title: string; content: string }> {
  revision: number
  proof: ChapterLeaseProof | null
  archive: (draft: T, revision: number) => boolean
  update: (
    revision: number,
    proof: ChapterLeaseProof,
    patch: Partial<T>,
  ) => Promise<ChapterWriteResult<{ revision: number }>>
}

export interface ChapterAutosaveOutcome<T> {
  result: AutosaveResult<T>
  revision?: number
  failure?: ChapterWriteFailure
  archiveFailed?: boolean
}

const leaseMissing: ChapterWriteFailure = {
  ok: false,
  code: 'lease-lost',
  message: 'Редактирование недоступно: глава открыта в другой сессии.',
}

/**
 * Единственная точка решения об автозаписи главы.
 *
 * Без lease-proof сервер не вызывается и очередь НЕ получает подтверждение:
 * иначе `undefined` означал бы успех, а несохранённый текст выглядел бы
 * сохранённым. Ошибка возвращается в очередь, черновик остаётся грязным и
 * архивируется.
 */
export async function saveChapterAutosave<T extends { title: string; content: string }>(
  draft: T,
  patch: Partial<T>,
  input: ChapterAutosaveInput<T>,
): Promise<ChapterAutosaveOutcome<T>> {
  const { title, ...contentPatch } = patch
  const invalidTitle = title !== undefined && !title.trim()
  const nextPatch = (invalidTitle ? contentPatch : patch) as Partial<T>

  if (!input.proof) {
    const error = new Error(leaseMissing.message)
    return {
      result: { acknowledged: {}, error },
      failure: leaseMissing,
      archiveFailed: !input.archive(draft, input.revision),
    }
  }

  if (!invalidTitle || contentPatch.content !== undefined) {
    const saved = await input.update(input.revision, input.proof, nextPatch)
    if (!saved.ok) {
      const shouldArchive = saved.code === 'conflict' ||
        saved.code === 'lease-lost' ||
        saved.code === 'lease-required' ||
        saved.code === 'forbidden'
      return {
        result: { acknowledged: {}, error: new Error(saved.message) },
        failure: saved,
        archiveFailed: shouldArchive ? !input.archive(draft, input.revision) : false,
      }
    }

    if (invalidTitle) {
      const error = new Error('Введите заголовок главы')
      return {
        result: { acknowledged: contentPatch as Partial<T>, error },
        revision: saved.value.revision,
        failure: { ok: false, code: 'validation', message: error.message },
      }
    }

    return { result: undefined, revision: saved.value.revision }
  }

  const error = new Error('Введите заголовок главы')
  return {
    result: { acknowledged: {}, error },
    failure: { ok: false, code: 'validation', message: error.message },
  }
}
