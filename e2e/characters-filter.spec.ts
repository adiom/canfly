import { test, expect } from '@playwright/test'

/**
 * Регрессия по фильтрам каталога /characters.
 *
 * Дефолтная выдача — только главные герои опубликованных релизов
 * (role = 'main'); ?role / ?release / ?series меняют выборку в SQL,
 * а активный чип обязан сходиться с ролью в URL.
 *
 * Тест не пишет в БД и не требует авторизации. На пустой базе
 * страница с любым фильтром всё ещё должна возвращать 200 + чипы;
 * проверки, зависящие от наличия персонажей, скипаются автоматически.
 */

const CHIP_LABELS = ['Главные', 'Все', 'Второстепенные', 'Камео'] as const

test.describe('characters catalog: role/release/series filters', () => {
  test('default page renders and «Главные» chip is active', async ({ page }) => {
    const res = await page.goto('/characters', { waitUntil: 'domcontentloaded' })
    expect(res?.status(), '/characters status').toBeLessThan(400)

    for (const label of CHIP_LABELS) {
      await expect(page.getByRole('link', { name: label })).toBeVisible()
    }

    const activeMain = page.getByRole('link', { name: 'Главные' })
    await expect(activeMain).toHaveAttribute('aria-current', 'page')
  })

  test('?role=all activates «Все» chip, no errors', async ({ page }) => {
    const res = await page.goto('/characters?role=all', { waitUntil: 'domcontentloaded' })
    expect(res?.status(), '/characters?role=all status').toBeLessThan(400)

    const activeAll = page.getByRole('link', { name: 'Все' })
    await expect(activeAll).toHaveAttribute('aria-current', 'page')
  })

  test('?role=supporting activates «Второстепенные» chip', async ({ page }) => {
    const res = await page.goto('/characters?role=supporting', { waitUntil: 'domcontentloaded' })
    expect(res?.status()).toBeLessThan(400)

    const activeChip = page.getByRole('link', { name: 'Второстепенные' })
    await expect(activeChip).toHaveAttribute('aria-current', 'page')
  })

  test('?role=invalid falls back to «Главные» (default)', async ({ page }) => {
    const res = await page.goto('/characters?role=invalid', { waitUntil: 'domcontentloaded' })
    expect(res?.status()).toBeLessThan(400)

    const activeMain = page.getByRole('link', { name: 'Главные' })
    await expect(activeMain).toHaveAttribute('aria-current', 'page')
  })

  test('?release=<slug> shows release filter context and stays 200', async ({ page }) => {
    const res = await page.goto('/characters?release=kroy-po-dushe', {
      waitUntil: 'domcontentloaded',
    })
    expect(res?.status(), '/characters?release= status').toBeLessThan(400)

    await expect(page.getByText('Показаны персонажи из:', { exact: false })).toBeVisible()
    // Чип-роль должен вешать release-slug на свой href при клике на роль.
    const allChip = page.getByRole('link', { name: 'Все', exact: true })
    const href = await allChip.getAttribute('href')
    expect(href, 'release must propagate into role-chip href').toContain('release=kroy-po-dushe')
  })

  test('?series=<slug> shows series filter context and stays 200', async ({ page }) => {
    const res = await page.goto('/characters?series=kroy-po-dushe', {
      waitUntil: 'domcontentloaded',
    })
    expect(res?.status()).toBeLessThan(400)

    await expect(page.getByText('Показаны персонажи из:', { exact: false })).toBeVisible()
    const allChip = page.getByRole('link', { name: 'Все', exact: true })
    const href = await allChip.getAttribute('href')
    expect(href, 'series must propagate into role-chip href').toContain('series=kroy-po-dushe')
  })

  test('«Все главные» reset link clears release filter', async ({ page }) => {
    await page.goto('/characters?release=kroy-po-dushe', { waitUntil: 'domcontentloaded' })
    await page.getByRole('link', { name: 'Все главные' }).click()

    await expect(page).toHaveURL(/\/characters\/?(\?.*)?$/)
    await expect(page).not.toHaveURL(/release=/)

    const activeMain = page.getByRole('link', { name: 'Главные' })
    await expect(activeMain).toHaveAttribute('aria-current', 'page')
  })
})

test.describe('characters catalog: regression on default-only-main', () => {
  /**
   * Дефолт выдаёт только role='main'. Сравниваем количество карточек на
   * /characters и /characters?role=all: «все» должно быть не меньше «главных».
   * Если на дефолте карточек столько же, сколько на all — значит, фильтр
   * по role='main' не работает (или в БД нет ни одного supporting/cameo).
   * На пустой/только-main базе тест скипается через skip-if-no-data.
   */
  test('/characters is a subset of ?role=all', async ({ page }) => {
    await page.goto('/characters', { waitUntil: 'domcontentloaded' })
    const mainNames = await page
      .locator('a[href^="/characters/"]')
      .evaluateAll((els) =>
        els
          .map((el) => (el as HTMLAnchorElement).getAttribute('href'))
          .filter((h): h is string => !!h && !h.endsWith('/characters')),
      )

    test.skip(mainNames.length === 0, 'no characters in DB')

    await page.goto('/characters?role=all', { waitUntil: 'domcontentloaded' })
    const allNames = await page
      .locator('a[href^="/characters/"]')
      .evaluateAll((els) =>
        els
          .map((el) => (el as HTMLAnchorElement).getAttribute('href'))
          .filter((h): h is string => !!h && !h.endsWith('/characters')),
      )

    expect(allNames.length, '?role=all must show >= than default main').toBeGreaterThanOrEqual(
      mainNames.length,
    )
    for (const name of mainNames) {
      expect(allNames, `main character ${name} must appear in ?role=all`).toContain(name)
    }
  })
})
