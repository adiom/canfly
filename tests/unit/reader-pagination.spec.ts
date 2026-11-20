import { test, expect } from '@playwright/test'
import { lastPageStart, clampPage, chapterProgress } from '@/lib/reader/pagination'

test.describe('reader pagination regressions', () => {
  for (const count of [1, 2, 3, 4, 5, 6]) {
    test(`${count} pages: every page remains reachable in a spread`, () => {
      const visible = new Set<number>()
      for (let start = 0; start <= lastPageStart(count, true); start += 2) {
        expect(clampPage(start, count, true)).toBe(start)
        visible.add(start)
        if (start + 1 < count) visible.add(start + 1)
      }
      expect([...visible]).toEqual(Array.from({ length: count }, (_, index) => index))
      expect(chapterProgress(lastPageStart(count, true), count, true)).toBe(1)
      expect(chapterProgress(count - 1, count, false)).toBe(1)
    })
  }

  test('resizing and backwards navigation retain the last odd page', () => {
    expect(clampPage(2, 3, true)).toBe(2)
    expect(clampPage(4, 5, true)).toBe(4)
    expect(clampPage(9, 3, true)).toBe(2)
    expect(clampPage(-2, 3, true)).toBe(0)
    expect(clampPage(3, 5, true)).toBe(2)
  })

  test('four-page chapter reaches 100% on its final spread', () => {
    expect(chapterProgress(2, 4, true)).toBe(1)
    expect(chapterProgress(0, 4, true)).toBeCloseTo(1 / 3)
  })
})
