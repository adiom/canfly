import type { EditionFormat, Chapter, Release } from '@/lib/releases-types'

const EDITION_FORMAT_LABELS: Record<EditionFormat, string> = {
  book: 'книга',
  comic: 'комикс',
  audiobook: 'аудиокнига',
  audiorelease: 'аудиорелиз',
  album: 'альбом',
  magazine: 'журнал',
  digital: 'цифровой релиз',
}

function stripHtmlTags(html: string): string {
  let text = html
  text = text.replace(/<br\s*\/?\s*>/gi, '\n')
  text = text.replace(/<\/p\s*>/gi, '\n\n')
  text = text.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h[1-6]\s*>/gi, (_, level, content) => {
    const hashes = '#'.repeat(Number(level))
    return `${hashes} ${content}`
  })
  text = text.replace(/<strong[^>]*>([\s\S]*?)<\/strong\s*>/gi, '**$1**')
  text = text.replace(/<em[^>]*>([\s\S]*?)<\/em\s*>/gi, '*$1*')
  text = text.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote\s*>/gi, (_, content) => {
    return content
      .split('\n')
      .map((line: string) => `> ${line}`)
      .join('\n')
  })
  text = text.replace(/<li[^>]*>([\s\S]*?)<\/li\s*>/gi, '- $1')
  text = text.replace(/<(ul|ol)[^>]*>/gi, '')
  text = text.replace(/<\/(ul|ol)\s*>/gi, '')
  text = text.replace(/<a[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a\s*>/gi, '[$2]($1)')
  text = text.replace(/<hr[^>]*>/gi, '\n---\n')
  text = text.replace(/<[^>]+>/g, '')
  text = text.replace(/&amp;/g, '&')
  text = text.replace(/&lt;/g, '<')
  text = text.replace(/&gt;/g, '>')
  text = text.replace(/&quot;/g, '"')
  text = text.replace(/&#39;|&apos;/g, "'")
  text = text.replace(/&nbsp;/g, ' ')
  return text.replace(/\n{3,}/g, '\n\n').trim()
}

function formatLabel(format: EditionFormat): string {
  return EDITION_FORMAT_LABELS[format]
}

function editionUrl(slug: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://canfly.org'
  return `${baseUrl}/vvvvv/${encodeURIComponent(slug)}`
}

export function buildEditionMarkdown({
  release,
  editionSlug,
  editionFormat,
  chapters,
}: {
  release: Release
  editionSlug: string
  editionFormat: EditionFormat
  chapters: Chapter[]
}): string {
  let markdown = `# ${release.title}\n\n`

  if (editionFormat !== 'book') {
    const label = formatLabel(editionFormat)
    markdown += `> Markdown-текст недоступен для этого издания.\n\n`
    markdown += `Это издание опубликовано в формате **${label}**. Формат не предназначен для представления как цельный книжный текст в Markdown.\n\n`
    markdown += `- Релиз: ${release.title}\n`
    markdown += `- Формат: ${label}\n`
    markdown += `- Издание: ${editionSlug}\n`
    markdown += `- Страница издания: ${editionUrl(editionSlug)}\n`
    return markdown
  }

  if (release.annotation) {
    markdown += `${stripHtmlTags(release.annotation)}\n\n---\n\n`
  }

  for (const chapter of chapters) {
    if (chapters.length > 1) markdown += `## ${chapter.title}\n\n`
    if (chapter.content) markdown += `${stripHtmlTags(chapter.content)}\n\n`
  }

  return markdown.trim() + '\n'
}
