'use client'

import { useEffect, useRef, useState } from 'react'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

/**
 * Debounced-autosave для узлов «дела» персонажа. Значение сравнивается как
 * строка (передавайте сериализованное представление — текст или JSON), чтобы
 * работало и для массивов (abilities). Save вызывается только при реальном
 * изменении после `delay` мс тишины.
 *
 * Возвращает текущий статус сохранения для индикатора «сохранено · …».
 */
export function useAutosave<T>(
  value: T,
  save: (value: T) => Promise<unknown>,
  delay = 800,
): SaveStatus {
  const [status, setStatus] = useState<SaveStatus>('idle')
  const lastSaved = useRef(value)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const changed = JSON.stringify(value) !== JSON.stringify(lastSaved.current)
    if (!changed) return

    setStatus('saving')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      try {
        await save(value)
        lastSaved.current = value
        setStatus('saved')
      } catch {
        setStatus('error')
      }
    }, delay)

    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, delay])

  return status
}
