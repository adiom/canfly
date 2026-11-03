import { test, expect } from '@playwright/test'
import { fetchNewsPosts } from '@/lib/server/news'
import { fetchPublicCharactersList } from '@/lib/server/characters'
import { loadEnvLocal } from './setup/pg'

test.describe('SEO: регрессии из Google Search Console', () => {
  test('URL с кириллицей не зацикливает нормализацию релиза', async ({ request }) => {
    const path = `/release/knife${encodeURIComponent('Нож')}`
    const response = await request.get(path, { maxRedirects: 0 })
    expect(response.status()).toBe(404)
    expect(response.headers().location).toBeUndefined()
  })

  test('регистр и подмаршрут релиза нормализуются одним редиректом', async ({ request }) => {
    const response = await request.get('/release/SEO-GSC-NOT-FOUND/full', { maxRedirects: 0 })
    expect(response.status()).toBe(301)
    expect(new URL(response.headers().location, response.url()).pathname).toBe('/release/seo-gsc-not-found')
  })

  test('Google может обойти редирект старого reader', async ({ request }) => {
    const robots = await request.get('/robots.txt')
    expect(robots.status()).toBe(200)
    expect(await robots.text()).not.toMatch(/^Disallow:\s*\/scroll/m)
    expect(await robots.text()).not.toMatch(/^Disallow:\s*\/vvvvv/m)

    const response = await request.get('/scroll/seo-gsc-not-found', { maxRedirects: 0 })
    expect(response.status()).toBe(301)
    expect(new URL(response.headers().location, response.url()).pathname).toBe('/vvvvv/seo-gsc-not-found')
  })

  test('UUID опубликованной новости постоянно перенаправляется на slug', async ({ request }) => {
    loadEnvLocal()
    test.skip(!process.env.DATABASE_URL, 'DATABASE_URL нужен для чтения опубликованной новости')
    const [post] = await fetchNewsPosts(1)
    test.skip(!post, 'нет опубликованных новостей')

    const response = await request.get(`/news/${post.id}`, {
      maxRedirects: 0,
      headers: { 'user-agent': 'Twitterbot/1.0' },
    })
    expect(response.status()).toBe(308)
    expect(new URL(response.headers().location, response.url()).pathname).toBe(`/news/${post.slug}`)
  })

  test('sitemap не выдаёт время генерации за дату обновления общих страниц', async ({ request }) => {
    const response = await request.get('/sitemap.xml')
    expect(response.status()).toBe(200)
    const entries = [...(await response.text()).matchAll(/<url>([\s\S]*?)<\/url>/g)]

    for (const path of ['/', '/releases', '/news', '/colors', '/vvvvv']) {
      const entry = entries.find(match => {
        const url = match[1].match(/<loc>([^<]+)<\/loc>/)?.[1]
        return url && new URL(url).pathname === path
      })
      expect(entry, `sitemap не содержит ${path}`).toBeDefined()
      expect(entry![1]).not.toContain('<lastmod>')
    }
  })

  test('sitemap использует даты изменения новостей и персонажей', async ({ request }) => {
    loadEnvLocal()
    test.skip(!process.env.DATABASE_URL, 'DATABASE_URL нужен для чтения дат записей')
    const [news, characters] = await Promise.all([
      fetchNewsPosts(1),
      fetchPublicCharactersList(),
    ])
    const post = news[0]
    const character = characters.find(item => item.character_type === 'person')
    test.skip(!post || !character, 'нет опубликованной новости или персонажа')

    const response = await request.get('/sitemap.xml')
    expect(response.status()).toBe(200)
    const entries = [...(await response.text()).matchAll(/<url>([\s\S]*?)<\/url>/g)]
    const expected = [
      { path: `/news/${post.slug}`, date: post.updated_at ?? post.published_at ?? post.created_at },
      { path: `/characters/${character!.slug}`, date: character!.updated_at },
    ]

    for (const { path, date } of expected) {
      const entry = entries.find(match => {
        const url = match[1].match(/<loc>([^<]+)<\/loc>/)?.[1]
        return url && new URL(url).pathname === path
      })
      expect(entry, `sitemap не содержит ${path}`).toBeDefined()
      expect(entry![1]).toContain(`<lastmod>${new Date(date).toISOString()}</lastmod>`)
    }
  })
})
