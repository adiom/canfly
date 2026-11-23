import { expect, test } from '@playwright/test'
import { normalizeComicPagesJson, parseComicPagesJson } from '@/lib/comic-content'

test('URL с query-параметрами сохраняет амперсанды', () => {
  const pages = ['https://cdn.example/page.jpg?width=800&height=1200', '/local?a=1&b=2']
  expect(parseComicPagesJson(JSON.stringify(pages))).toEqual(pages)
  expect(normalizeComicPagesJson(JSON.stringify(pages))).toBe(JSON.stringify(pages))
  expect(normalizeComicPagesJson(JSON.stringify(pages))).not.toContain('&amp;')
})

test('JSON комикса нельзя интерпретировать как HTML, URL восстанавливаются', () => {
  const pages = ['https://example.test/<img src=x onerror=alert(1)>?a=1&b=2']
  const safe = normalizeComicPagesJson(JSON.stringify(pages))
  expect(safe).not.toContain('<img')
  expect(safe).toContain('\\u003c')
  expect(parseComicPagesJson(safe)).toEqual(pages)
})

test('HTML и некорректный JSON не считаются страницами комикса', () => {
  expect(parseComicPagesJson('<p>a & b</p>')).toBeNull()
  expect(parseComicPagesJson('["a", 1]')).toBeNull()
  expect(parseComicPagesJson('[{]')).toBeNull()
  expect(normalizeComicPagesJson(null)).toBeNull()
})
