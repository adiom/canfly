import type { HomepageSlideTheme, PublicRole, SystemRole } from '@/lib/types'

/** Normalize a string array — filter non-strings, trim, remove empties */
export function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
}

/** Parse abilities from JSON string or array — for DB response parsing */
export function parseAbilities(value: unknown): string[] {
  if (!value) return []
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string')
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
    } catch {
      return []
    }
  }
  return []
}

/** Helper: optional trimmed string or null */
export function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

/** Normalize a character payload from admin API */
interface NormalizedCharacterResult {
  data: {
    name: string
    slug: string
    avatar: string | null
    bio: string | null
    full_description: string | null
    abilities: string[]
    speaking_style: string | null
    personality: string | null
    boundaries: string | null
    knowledge_scope: string | null
    spoiler_policy: string | null
    reply_mode: string
    can_receive_messages: boolean
  }
}

/** Normalize a character payload from admin API */
export function normalizeCharacterPayload(
  body: Record<string, unknown>,
): { error: string } | NormalizedCharacterResult {
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const slug = typeof body.slug === 'string' ? body.slug.trim() : ''

  if (!name || !slug) {
    return { error: 'Name and slug are required' }
  }

  return {
    data: {
      name,
      slug,
      avatar:
        typeof body.avatar === 'string' && body.avatar.trim()
          ? body.avatar.trim()
          : null,
      bio:
        typeof body.bio === 'string' && body.bio.trim()
          ? body.bio.trim()
          : null,
      full_description:
        typeof body.full_description === 'string' && body.full_description.trim()
          ? body.full_description.trim()
          : null,
      abilities: normalizeStringArray(body.abilities),
      speaking_style:
        typeof body.speaking_style === 'string' && body.speaking_style.trim()
          ? body.speaking_style.trim()
          : null,
      personality:
        typeof body.personality === 'string' && body.personality.trim()
          ? body.personality.trim()
          : null,
      boundaries:
        typeof body.boundaries === 'string' && body.boundaries.trim()
          ? body.boundaries.trim()
          : null,
      knowledge_scope:
        typeof body.knowledge_scope === 'string' && body.knowledge_scope.trim()
          ? body.knowledge_scope.trim()
          : null,
      spoiler_policy:
        typeof body.spoiler_policy === 'string' && body.spoiler_policy.trim()
          ? body.spoiler_policy.trim()
          : null,
      reply_mode:
        body.reply_mode === 'manual' ||
        body.reply_mode === 'hybrid' ||
        body.reply_mode === 'disabled'
          ? body.reply_mode
          : 'ai_auto',
      can_receive_messages: body.can_receive_messages !== false,
    },
  }
}

interface NormalizedNewsResult {
  data: {
    section: string
    title: string
    content: string | null
    tag: string | null
    display_order: number
    is_active: boolean
  }
}

/** Normalize a news payload from admin API */
export function normalizeNewsPayload(
  body: Record<string, unknown>,
): { error: string } | NormalizedNewsResult {
  const section = typeof body.section === 'string' ? body.section.trim() : ''
  const title = typeof body.title === 'string' ? body.title.trim() : ''

  if (!section || !title) {
    return { error: 'Section and title are required' }
  }

  return {
    data: {
      section,
      title,
      content:
        typeof body.content === 'string' && body.content.trim()
          ? body.content.trim()
          : null,
      tag:
        typeof body.tag === 'string' && body.tag.trim()
          ? body.tag.trim()
          : null,
      display_order: typeof body.display_order === 'number' ? body.display_order : 0,
      is_active: typeof body.is_active === 'boolean' ? body.is_active : true,
    },
  }
}

/** Normalize public role — reader/author; defaults to 'reader'. */
export function normalizePublicRole(value: unknown): PublicRole {
  return value === 'author' ? 'author' : 'reader'
}

/** Normalize system roles — currently only editor. */
export function normalizeRoles(value: unknown): SystemRole[] {
  if (!Array.isArray(value)) return []
  return value.filter((role): role is SystemRole => role === 'editor')
}

/** Normalize system roles for user update — returns null if invalid */
export function normalizeRolesUpdate(value: unknown): SystemRole[] | null {
  if (!Array.isArray(value)) return null
  return value.filter((role): role is SystemRole => role === 'editor')
}

export const SLIDE_THEMES: HomepageSlideTheme[] = [
  'atelier',
  'night-city',
  'pvz',
  'volga',
  'dreams',
]

interface NormalizedSlideResult {
  data: {
    title: string
    eyebrow: string | null
    description: string | null
    background_image: string | null
    mobile_image: string | null
    primary_cta_label: string | null
    primary_cta_href: string | null
    secondary_cta_label: string | null
    secondary_cta_href: string | null
    aside_label: string | null
    aside_number: string | null
    aside_text: string | null
    theme: HomepageSlideTheme
    is_active: boolean
    display_order: number
  }
}

/** Normalize a homepage slide payload from admin API */
export function normalizeSlidePayload(
  body: Record<string, unknown>,
): { error: string } | NormalizedSlideResult {
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const displayOrder =
    typeof body.display_order === 'number' && Number.isFinite(body.display_order)
      ? body.display_order
      : 0
  const theme = SLIDE_THEMES.includes(body.theme as HomepageSlideTheme)
    ? (body.theme as HomepageSlideTheme)
    : 'atelier'

  if (!title) {
    return { error: 'Title is required' }
  }

  return {
    data: {
      title,
      eyebrow: optionalString(body.eyebrow),
      description: optionalString(body.description),
      background_image: optionalString(body.background_image),
      mobile_image: optionalString(body.mobile_image),
      primary_cta_label: optionalString(body.primary_cta_label),
      primary_cta_href: optionalString(body.primary_cta_href),
      secondary_cta_label: optionalString(body.secondary_cta_label),
      secondary_cta_href: optionalString(body.secondary_cta_href),
      aside_label: optionalString(body.aside_label),
      aside_number: optionalString(body.aside_number),
      aside_text: optionalString(body.aside_text),
      theme,
      is_active: Boolean(body.is_active),
      display_order: displayOrder,
    },
  }
}
