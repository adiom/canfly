import { test, expect } from '@playwright/test'

test.describe('public interface regressions', () => {
  test('landscape search fits the screen and has an explicit empty state', async ({ page }) => {
    await page.setViewportSize({ width: 667, height: 375 })
    await page.route('**/api/search?*', route => route.fulfill({ json: { results: [] } }))
    await page.goto('/colors')
    await page.getByRole('button', { name: 'Поиск (Cmd+K)' }).click()
    await page.keyboard.press('Escape')
    await page.keyboard.press('Control+k')
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('combobox').fill('несуществующий')
    await expect(dialog.getByText('Ничего не найдено')).toBeVisible()
    const bounds = await dialog.boundingBox()
    expect(bounds).not.toBeNull()
    expect(bounds!.y).toBeGreaterThanOrEqual(0)
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(375)
    await page.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible()
  })

  test('arrows and Enter select an actual search result', async ({ page }) => {
    await page.route('**/api/search?*', route => route.fulfill({ json: {
      results: [{ id: 'test-release', kind: 'release', title: 'Тестовый релиз', subtitle: 'Проверка', href: '/colors?selected=release', image: null }],
    } }))
    await page.goto('/colors')
    await page.getByRole('button', { name: 'Поиск (Cmd+K)' }).click()
    await page.keyboard.press('Escape')
    await page.keyboard.press('Control+k')
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('combobox').fill('тест')
    const result = dialog.getByRole('option', { name: /Тестовый релиз/ })
    await expect(result).toBeVisible()
    await page.keyboard.press('ArrowDown')
    await expect(result).toHaveAttribute('data-selected', 'true')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/selected=release/)
    await expect(dialog).not.toBeVisible()
  })

  test('mobile menu close button is visible above the sticky header', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/colors')
    await page.getByRole('button', { name: /меню/i }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: /close|закрыть/i }).click()
    await expect(dialog).not.toBeVisible()
  })

  test('reading progress endpoint retains its authentication requirement', async ({ request }) => {
    const response = await request.post('/api/reading-progress', { data: {
      editionId: '11111111-1111-4111-8111-111111111111',
      chapterId: '22222222-2222-4222-8222-222222222222',
      progressPercent: 100,
      position: { paragraphIndex: 3, offset: 10 },
    } })
    expect(response.status()).toBe(401)
  })
})
