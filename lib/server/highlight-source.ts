import 'server-only'
import sanitize from 'sanitize-html'
import { createHash } from 'node:crypto'
import { normalizeHighlightText } from '@/lib/highlights/anchor'
import { dbQueryOne } from '@/lib/db'

export function chapterPlainText(html: string): string {
  let text = ''
  // onOpenTag/onCloseTag see decoded parser text via the textFilter callback.
  sanitize(html, {
    allowedTags: [], allowedAttributes: {},
    textFilter(value) { text += value.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&'); return value },
    onOpenTag(tag) { if (/^(p|div|br|li|blockquote|h[1-6]|tr|pre|hr)$/.test(tag)) text += ' ' },
    onCloseTag(tag) { if (/^(p|div|li|blockquote|h[1-6]|tr|pre)$/.test(tag)) text += ' ' },
  })
  return normalizeHighlightText(text)
}
export function sourceRevision(text: string): string {
  return createHash('sha256').update(text).digest('hex')
}
export async function highlightSource(chapterId: string, userId: string | null) {
  return dbQueryOne<{
    content: string; available: boolean; allowed: boolean
  }>(`SELECT ch.content,
    (ch.status='published' AND e.status='published' AND r.status='published') AS available,
    ((ch.status='published' AND e.status='published' AND r.status='published') OR EXISTS
      (SELECT 1 FROM users u WHERE u.id=$2 AND u.is_admin) OR EXISTS
      (SELECT 1 FROM release_collaborators rc WHERE rc.release_id=r.id AND rc.user_id=$2 AND rc.role='owner')) AS allowed
    FROM chapters ch JOIN editions e ON e.id=ch.edition_id JOIN releases r ON r.id=e.release_id
    WHERE ch.id=$1`, [chapterId, userId])
}
