interface ReaderPreviewNoticeProps {
  releaseStatus: string
  editionStatus: string
  unpublishedChapterCount?: number
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'черновик',
  published: 'опубликован',
  archived: 'архив',
}

export function ReaderPreviewNotice({
  releaseStatus,
  editionStatus,
  unpublishedChapterCount = 0,
}: ReaderPreviewNoticeProps) {
  return (
    <aside
      aria-label="Предпросмотр администратора"
      className="border-b border-[var(--cf-accent)] bg-[var(--cf-bg)] px-3 py-2 text-xs text-[var(--cf-text-1)]"
      style={{ fontFamily: 'var(--font-geist-sans)' }}
    >
      <strong className="text-[var(--cf-accent)]">Предпросмотр администратора</strong>
      <span className="ml-2 inline-block">
        Релиз: {STATUS_LABELS[releaseStatus] ?? releaseStatus}. Издание: {STATUS_LABELS[editionStatus] ?? editionStatus}.
        {unpublishedChapterCount > 0 && ` Неопубликованных глав: ${unpublishedChapterCount}.`}
      </span>
    </aside>
  )
}
