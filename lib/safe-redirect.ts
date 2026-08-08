/**
 * Пропускает только внутренние пути. Отсекает абсолютные URL,
 * протокол-относительные (`//example.com`) и вариант с обратным слешем
 * (`/\example.com`) — браузеры трактуют его как протокол-относительный.
 *
 * Нужен там, где `?redirect=` из query-строки уходит в навигацию:
 * без проверки ссылка вида `/login?redirect=https://example.com` уносила
 * пользователя наружу сразу после успешного входа.
 */
export function safeInternalPath(
  value: string | null | undefined,
  fallback = '/profile',
): string {
  if (!value || !value.startsWith('/')) return fallback
  if (value.startsWith('//') || value.startsWith('/\\')) return fallback
  return value
}
