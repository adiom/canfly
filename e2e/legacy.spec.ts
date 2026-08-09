import { test, expect } from '@playwright/test'

/**
 * Регрессия на удаление legacy-системы книг (09.08.2026).
 *
 * Код legacy-системы (`/books/**`, `/shop`, `/cart`, админка книг,
 * `lib/server/books.ts`) удалён, но:
 * 1. старые URL годами живут в индексе Google — proxy.ts держит для них 301;
 * 2. `/api/books` и `/api/orders` остались надгробиями — не должны воскрешаться;
 * 3. таблицы `books`, `book_characters`, `orders` остались в БД как архив —
 *    запросов к ним из живого кода быть не должно (проверяется косвенно: все
 *    маршруты ниже отвечают, а не падают на отсутствующих таблицах).
 *
 * Тест не требует авторизации и не трогает БД — только HTTP-поведение.
 */

const REDIRECTS: { path: string; location: string }[] = [
  // Каталог и корзина — всё на каталог Release
  { path: '/books', location: '/releases/' },
  { path: '/books/my-book', location: '/release/my-book' },
  { path: '/books/my-book/3', location: '/release/my-book' },
  { path: '/books/my-book/full', location: '/release/my-book' },
  { path: '/shop', location: '/releases/' },
  { path: '/shop/some-page', location: '/releases/' },
  { path: '/cart', location: '/releases/' },
  { path: '/cart/checkout', location: '/releases/' },
  // Старая читалка на новую (UUID-форма сохраняется)
  { path: '/reader/11111111-1111-1111-1111-111111111111', location: '/vvvvv/11111111-1111-1111-1111-111111111111' },
]

test.describe('legacy: 301-редиректы на систему Release', () => {
  for (const { path, location } of REDIRECTS) {
    test(`GET ${path} → 301 → ${location}`, async ({ request }) => {
      const res = await request.get(path, { maxRedirects: 0 })
      expect(res.status(), `HTTP status for ${path}`).toBe(301)
      expect(res.headers()['location'], `Location for ${path}`).toBe(location)
    })
  }
})

test.describe('legacy: надгробия API не воскрешаются', () => {
  test('GET /api/books отвечает retired', async ({ request }) => {
    const res = await request.get('/api/books')
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.status).toBe('retired')
    expect(body.suggestion).toBe('/api/releases')
  })

  test('POST /api/books отвечает retired', async ({ request }) => {
    const res = await request.post('/api/books', { data: {} })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.status).toBe('retired')
  })

  test('POST /api/orders отвечает 410', async ({ request }) => {
    const res = await request.post('/api/orders', { data: {} })
    expect(res.status()).toBe(410)
  })
})
