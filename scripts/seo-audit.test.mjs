import test from 'node:test'
import assert from 'node:assert/strict'
import { classifyStatus, inspectCanonical, sitemapLocs } from './seo-audit.mjs'

test('classifies HTTP status by whether the URL belongs to sitemap', () => {
  assert.equal(classifyStatus(200), 'ok')
  assert.equal(classifyStatus(308), 'redirect')
  assert.equal(classifyStatus(404, { inSitemap: false }), 'expected-missing')
  assert.equal(classifyStatus(410, { inSitemap: false }), 'expected-missing')
  for (const status of [401, 403, 404, 410, 429]) {
    assert.equal(classifyStatus(status, { inSitemap: true }), 'client-error')
  }
  assert.equal(classifyStatus(503), 'server-error')
})

test('reads page URLs without mistaking image locations for pages', () => {
  const xml = '<urlset><url><loc>https://canfly.org/release/work</loc><image:image><image:loc>https://cdn.example/image.jpg</image:loc></image:image></url></urlset>'
  assert.deepEqual(sitemapLocs(xml), ['https://canfly.org/release/work'])
})

test('reads child sitemap URLs from sitemap index', () => {
  const xml = '<sitemapindex><sitemap><loc>https://canfly.org/sitemap-pages.xml</loc></sitemap></sitemapindex>'
  assert.deepEqual(sitemapLocs(xml, true), ['https://canfly.org/sitemap-pages.xml'])
})

test('allows matching production canonical on Vercel preview only', () => {
  const base = 'https://canfly-git-codex-seo-technical-audit-adioms-projects.vercel.app'
  assert.deepEqual(inspectCanonical('https://canfly.org/releases?category=book', `${base}/releases?category=book`, base).issues, [])
  assert.equal(inspectCanonical('https://canfly.org/other', `${base}/releases`, base).issues.length, 1)
  assert.equal(inspectCanonical('https://example.com/releases', `${base}/releases`, base).issues.length, 2)
  assert.deepEqual(inspectCanonical('https://canfly.org/releases', 'https://canfly.org/releases', 'https://canfly.org').issues, [])
})

