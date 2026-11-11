import { test, expect } from '@playwright/test'
import type { Chapter } from '../../lib/releases-types'
import { chapterReadPage, chapterTextMessage, chapterWriteReceipt } from '../../lib/mcp/chapter-response'
import { signEditionExport, verifyEditionExport, EXPORT_LINK_LIFETIME_SECONDS } from '../../lib/server/mcp-export-links'

const chapter: Chapter = {
  id: '22a646a6-27bc-4c64-8f1c-5de468767acd',
  edition_id: 'ae4d7384-c8b8-4c34-9ab6-36192d3d36e1',
  title: 'Диалоги и стихи',
  content: '<p>Маша: «Привет» 😊</p>\n<p>Дождь — стих.</p>',
  chapter_index: 1,
  status: 'draft',
  word_count: 5,
  audio_url: null,
  audio_blob_path: null,
  duration_seconds: null,
  audio_metadata: {},
  audio_content_type: null,
  audio_file_size_bytes: null,
  audio_uploaded_at: null,
  view_count: 0,
  created_at: '2026-11-11T00:00:00.000Z',
  updated_at: '2026-11-11T00:00:00.000Z',
  published_at: null,
}

test('MCP writing receipts never return the manuscript body', () => {
  const receipt = chapterWriteReceipt(chapter)
  expect(receipt.ok).toBe(true)
  expect(receipt.status).toBe('draft')
  expect(receipt).not.toHaveProperty('content')
  expect(receipt.content_hash).toMatch(/^[a-f0-9]{64}$/)
})

test('MCP chapter pages reconstruct Unicode content without loss', () => {
  const length = Array.from(chapter.content ?? '').length
  let offset = 0
  let reconstructed = ''
  let digest: string | undefined
  do {
    const page = chapterReadPage(chapter, offset, 7)
    if (digest) expect(page.content_hash).toBe(digest)
    digest = page.content_hash
    reconstructed += page.content
    offset = page.next_offset ?? length
    if (page.next_offset === null) break
  } while (offset < length)
  expect(reconstructed).toBe(chapter.content)
})

test('Signed draft export rejects altered signatures and expired links', () => {
  const now = 1800000000
  const expires = now + EXPORT_LINK_LIFETIME_SECONDS
  const secret = 'unit-test-export-secret'
  const signature = signEditionExport(chapter.edition_id, 'docx', expires, secret)
  expect(verifyEditionExport(chapter.edition_id, 'docx', String(expires), signature, now, secret)).toBe(true)
  expect(verifyEditionExport(chapter.edition_id, 'md', String(expires), signature, now, secret)).toBe(false)
  expect(verifyEditionExport(chapter.id, 'docx', String(expires), signature, now, secret)).toBe(false)
  expect(verifyEditionExport(chapter.edition_id, 'docx', String(expires), signature, expires + 1, secret)).toBe(false)
  expect(verifyEditionExport(chapter.edition_id, 'docx', String(expires + 900), signature, now, secret)).toBe(false)
})

test('Fallback chapter reader returns plain text MCP message with safe pagination', () => {
  const first = chapterTextMessage(chapter, 0, 7)
  const page = chapterReadPage(chapter, 0, 7)
  expect(first).toContain('CHAPTER ' + chapter.id)
  expect(first).toContain('CONTENT_SHA256: ' + page.content_hash)
  expect(first).toContain('NEXT_OFFSET: ' + page.next_offset)
  expect(first).toContain(page.content)
  expect(first).not.toContain('\\\"content\\\"')
  const tail = chapterTextMessage(chapter, 10_000, 7)
  expect(tail).toContain('NEXT_OFFSET: END')
})
