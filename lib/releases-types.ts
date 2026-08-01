export type ReleaseStatus = 'draft' | 'published' | 'archived'
export type EditionStatus = 'draft' | 'published' | 'archived'
export type EditionFormat = 'book' | 'comic' | 'audiobook' | 'audiorelease' | 'album' | 'magazine'
export type QualityTier = 'draft' | 'standard' | 'premium'
export type MediaType = 'trailer' | 'podcast' | 'review' | 'other'
export type CollaboratorRole = 'owner' | 'editor' | 'viewer'
export type ChapterStatus = 'draft' | 'published'
export type ReleaseCharacterRole = 'main' | 'supporting' | 'cameo'
export type CommentStatus = 'pending' | 'approved' | 'spam'
export type HeroStyle = 'full' | 'centered' | 'minimal'
export type HeroOverlay = 'dark' | 'gradient' | 'none'
export type ReleaseLayout = 'wide' | 'narrow' | 'sidebar'

export interface ReleaseDesignConfig {
  accent_color?: string
  bg_color?: string
  text_color?: string
  hero_style?: HeroStyle
  hero_overlay?: HeroOverlay
  layout?: ReleaseLayout
  show_toc?: boolean
  show_characters?: boolean
  show_series?: boolean
}

export interface ReleaseAuthor {
  name: string
  role: string
}

export interface Release {
  id: string
  title: string
  slug: string
  description: string | null
  cover_image: string | null
  genre: string | null
  release_date: string | null
  isbn: string | null
  authors: ReleaseAuthor[]
  annotation: string | null
  editor_notes: string | null
  view_count: number
  status: ReleaseStatus
  design_config: ReleaseDesignConfig
  created_at: string
  updated_at: string
}

export interface Series {
  id: string
  title: string
  slug: string
  description: string | null
  created_at: string
  updated_at: string
}

export interface Edition {
  id: string
  release_id: string
  format: EditionFormat
  platform: string | null
  external_url: string | null
  slug: string
  status: EditionStatus
  is_primary: boolean
  quality_tier: QualityTier
  created_at: string
  updated_at: string
}

export interface Chapter {
  id: string
  edition_id: string
  title: string
  content: string | null
  audio_url: string | null
  audio_blob_path: string | null
  duration_seconds: number | null
  audio_metadata: Record<string, unknown>
  audio_content_type: string | null
  audio_file_size_bytes: number | null
  audio_uploaded_at: string | null
  chapter_index: number
  status: ChapterStatus
  word_count: number
  view_count: number
  created_at: string
  updated_at: string
  published_at: string | null
}

export interface LyricLine {
  text: string
  time?: number
}

export interface ChapterLyrics {
  format: 'synced' | 'plain'
  lines: LyricLine[]
}

export function extractLyrics(metadata: Record<string, unknown>): ChapterLyrics | null {
  const raw = metadata.lyrics
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  if (obj.format !== 'synced' && obj.format !== 'plain') return null
  if (!Array.isArray(obj.lines)) return null
  const lines: LyricLine[] = []
  for (const line of obj.lines) {
    if (!line || typeof line !== 'object') continue
    const l = line as Record<string, unknown>
    if (typeof l.text !== 'string' || !l.text) continue
    lines.push({ text: l.text, time: typeof l.time === 'number' && l.time >= 0 ? l.time : undefined })
  }
  if (lines.length === 0) return null
  return { format: obj.format as 'synced' | 'plain', lines }
}

export interface ReleaseSeries {
  release_id: string
  series_id: string
  phase_number: number | null
}

export interface ReleaseCharacter {
  release_id: string
  character_id: string
  role: ReleaseCharacterRole
}

export interface Comment {
  id: string
  release_id: string
  user_id: string
  content: string
  status: CommentStatus
  created_at: string
}

export interface ReleaseMedia {
  id: string
  release_id: string
  type: MediaType
  title: string
  url: string
  description: string | null
  created_at: string
}

export interface ReadingProgress {
  id: string
  edition_id: string
  chapter_id: string
  user_id: string | null
  session_id: string | null
  progress_percent: number
  last_read_at: string
}

export interface ReleaseCollaborator {
  release_id: string
  user_id: string
  role: CollaboratorRole
}

export interface Bookmark {
  id: string
  chapter_id: string
  user_id: string
  note: string | null
  created_at: string
}

export interface ChapterVersion {
  id: string
  chapter_id: string
  content: string
  version_number: number
  created_at: string
}

// === Release Events (HomeIssuesSection) ===

export type ReleaseEventType = 'new_edition' | 'new_chapter'

export interface ReleaseEvent {
  event_type: ReleaseEventType
  release_id: string
  release_title: string
  release_slug: string
  cover_image: string | null
  edition_id: string
  edition_slug: string
  format: EditionFormat
  quality_tier: QualityTier | null
  chapter_title: string | null
  chapter_index: number | null
  new_chapters_count: number
  new_editions_count: number
  event_at: string
}

// === Chapter Highlights ===

export interface ChapterHighlight {
  id: string
  chapter_id: string
  user_id: string
  text_content: string
  paragraph_index: number | null
  context_before: string | null
  context_after: string | null
  client_request_id?: string | null
  start_offset?: number | null
  end_offset?: number | null
  source_chapter_updated_at?: string | null
  note: string | null
  is_public: boolean
  likes_count: number
  created_at: string
  updated_at?: string
  // Joins
  user_name?: string | null
  user_avatar?: string | null
  is_liked_by_me?: boolean
  release_slug?: string
  chapter_title?: string
}

export interface ChapterHighlightInput {
  chapter_id: string
  text_content: string
  paragraph_index?: number | null
  context_before?: string | null
  context_after?: string | null
  client_request_id?: string
  start_offset?: number | null
  end_offset?: number | null
  note?: string | null
  is_public: boolean
}

// === Editorial Notes (только для Studio) ===

export type EditorialNoteStatus = 'open' | 'resolved' | 'ignored'

export interface ChapterEditorialNote {
  id: string
  chapter_id: string
  author_id: string
  text_content: string
  paragraph_index: number | null
  context_before: string | null
  context_after: string | null
  client_request_id?: string | null
  start_offset?: number | null
  end_offset?: number | null
  source_chapter_updated_at?: string | null
  note: string
  status: EditorialNoteStatus
  created_at: string
  resolved_at: string | null
  updated_at?: string
  // Joins
  author_name?: string | null
  author_avatar?: string | null
}
