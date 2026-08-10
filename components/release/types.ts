import type { ChapterHighlight, Edition, Release, Series } from '@/lib/releases-types'

export type ReleaseMeta = {
  chapterCount: number
  wordCount: number
  readingMinutes: number
  durationSeconds: number
}

export type ReleaseCharacter = {
  id: string
  name: string
  slug: string
  avatar: string | null
  role: string
}

export type OtherSeriesRelease = {
  id: string
  title: string
  slug: string
  annotation: string | null
  cover_image: string | null
  release_date: string | null
  phase_number: number | null
}

export type ReleasePagePublicProps = {
  release: Release
  editions: Edition[]
  primaryEditionSlug: string | null
  seriesLink: { series: Series; phase_number: number | null } | null
  highlights: ChapterHighlight[]
  meta: ReleaseMeta
  characters: ReleaseCharacter[]
  otherSeriesReleases: OtherSeriesRelease[]
}
