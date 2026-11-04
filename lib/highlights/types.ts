export interface TextAnchor {
  version: 2
  start: number
  end: number
  exact: string
  prefix: string
  suffix: string
  revision: string
}

export type MaterialKind = 'text' | 'explain' | 'meaning' | 'rewrite' | 'image'
export interface HighlightMaterial {
  id: string
  highlight_id: string
  kind: MaterialKind
  origin: 'manual' | 'ai' | 'upload'
  parent_id: string | null
  content: string
  image_url: string | null
  created_at: string
}

export interface HighlightPublication {
  note: string | null
  materials: HighlightMaterial[]
  published_at: string
}

export interface HighlightWorkshop {
  id: string
  chapter_id: string
  user_id: string
  text_content: string
  note: string | null
  draft_text: string
  version: number
  is_public: boolean
  publication: HighlightPublication | null
  anchor: TextAnchor | null
  materials: HighlightMaterial[]
  likes_count: number
  is_liked_by_me: boolean
  is_saved: boolean
  user_name: string | null
  chapter_title: string
  edition_slug: string
  release_title: string
  release_slug: string
  authors: { name: string; role: string }[]
  source_available: boolean
  anchor_status: 'exact' | 'moved' | 'missing'
  permissions: { edit: boolean; publish: boolean; save: boolean }
}
