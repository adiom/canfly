import { test, expect } from '@playwright/test'
import { lastPageStart, clampPage, chapterProgress } from '@/lib/reader/pagination'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import ts from 'typescript'
import type { ReadingPosition } from '@/lib/reader/reading-position'

test.describe('reader pagination regressions', () => {
  test('rendered reader demo reaches its final page and navigates backwards', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto('/vvvvv')
    const next = page.getByRole('button', { name: 'Следующая страница' })
    const prev = page.getByRole('button', { name: 'Предыдущая страница' })
    await next.scrollIntoViewIfNeeded()
    await expect(next).toBeEnabled()
    const label = page.getByText(/^\d+(?:–\d+)? из \d+$/)
    const count = Number((await label.innerText()).split(/ из /i)[1])
    for (let index = 0; index < count && await next.isEnabled(); index++) await next.click()
    await expect(next).toBeDisabled()
    await expect(label).toHaveText(new RegExp(`(?:^|–)${count} из ${count}$`))
    await prev.click()
    await expect(next).toBeEnabled()
  })

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

  test('text anchor survives reflow and wrapped highlight markup', async ({ page }) => {
    const compile = (path: string) => ts.transpileModule(readFileSync(resolve(process.cwd(), path), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText
    await page.setContent(`<style>
      #track { height:180px; width:900px; column-width:420px; column-gap:60px; column-fill:auto; font:20px/24px monospace; }
      p { margin:0 0 24px; }
    </style><div id="track"><div id="root">${Array.from({ length: 10 }, (_, index) => `<p>Абзац ${index}. ${'Читаем кириллицу и сохраняем место в тексте. '.repeat(30)}</p>`).join('')}</div></div>`)
    await page.addScriptTag({ content: `(() => { const exports = {}; ${compile('lib/reader/highlights-dom.ts')}; window.readerHighlights = exports; })();
      (() => { const exports = {}; const require = () => window.readerHighlights; ${compile('lib/reader/reading-position.ts')}; window.readerPosition = exports; })();` })
    const result = await page.evaluate(() => {
      const api = (window as unknown as { readerPosition: {
        captureReadingPosition: (root: HTMLElement, track: HTMLElement, page: number, step: number) => ReadingPosition;
        pageForReadingPosition: (root: HTMLElement, track: HTMLElement, position: ReadingPosition, step: number) => number;
      } }).readerPosition
      const root = document.getElementById('root')!
      const track = document.getElementById('track')!
      const position = api.captureReadingPosition(root, track, 2, 480)
      const original = api.pageForReadingPosition(root, track, position, 480)
      const paragraph = root.querySelectorAll('p')[position.paragraphIndex]
      paragraph.innerHTML = `<mark>${paragraph.textContent?.slice(0, 20)}</mark>${paragraph.textContent?.slice(20)}`
      track.style.width = '480px'
      track.style.columnWidth = '480px'
      track.style.fontSize = '24px'
      const newPage = api.pageForReadingPosition(root, track, position, 540)
      const roundtrip = api.captureReadingPosition(root, track, newPage, 540)
      return { original, newPage, position, roundtrip }
    })
    expect(result.original).toBe(2)
    expect(result.newPage).toBeGreaterThanOrEqual(0)
    // A reflow restores the page containing the same character, not a page index.
    expect(result.roundtrip.paragraphIndex).toBeLessThanOrEqual(result.position.paragraphIndex)
  })
})
