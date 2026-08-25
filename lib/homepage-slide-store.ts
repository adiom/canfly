import { dbQuery, dbQueryOne } from '@/lib/db'
import { HomepageSlide } from '@/lib/types'

export type SlideData = Omit<HomepageSlide, 'id' | 'created_at' | 'updated_at'>

export function isHomepageSlidesTableMissing(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  const code = error && typeof error === 'object' && 'code' in error ? error.code : null

  return (
    code === '42P01' ||
    message.includes('homepage_slides') ||
    message.includes('relation') ||
    message.includes('Could not find the table') ||
    message.includes('schema cache') ||
    message.includes('PGRST205')
  )
}

export async function getPublicHomepageSlides() {
  return dbQuery<HomepageSlide>(
    'SELECT * FROM homepage_slides WHERE is_active = true ORDER BY display_order ASC',
  )
}

export async function listAdminHomepageSlides() {
  return dbQuery<HomepageSlide>('SELECT * FROM homepage_slides ORDER BY display_order ASC')
}

export async function getAdminHomepageSlide(id: string) {
  return dbQueryOne<HomepageSlide>('SELECT * FROM homepage_slides WHERE id = $1 LIMIT 1', [id])
}

export async function createAdminHomepageSlide(data: SlideData) {
  return dbQueryOne<HomepageSlide>(
    `
      INSERT INTO homepage_slides (
        title,
        eyebrow,
        description,
        background_image,
        mobile_image,
        primary_cta_label,
        primary_cta_href,
        secondary_cta_label,
        secondary_cta_href,
        aside_label,
        aside_number,
        aside_text,
        theme,
        is_active,
        display_order
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12,
        $13::homepage_slide_theme,
        $14,
        $15
      )
      RETURNING *
    `,
    [
      data.title,
      data.eyebrow,
      data.description,
      data.background_image,
      data.mobile_image,
      data.primary_cta_label,
      data.primary_cta_href,
      data.secondary_cta_label,
      data.secondary_cta_href,
      data.aside_label,
      data.aside_number,
      data.aside_text,
      data.theme,
      data.is_active,
      data.display_order,
    ],
  )
}

export async function updateAdminHomepageSlide(id: string, data: SlideData) {
  return dbQueryOne<HomepageSlide>(
    `
      UPDATE homepage_slides
      SET
        title = $2,
        eyebrow = $3,
        description = $4,
        background_image = $5,
        mobile_image = $6,
        primary_cta_label = $7,
        primary_cta_href = $8,
        secondary_cta_label = $9,
        secondary_cta_href = $10,
        aside_label = $11,
        aside_number = $12,
        aside_text = $13,
        theme = $14::homepage_slide_theme,
        is_active = $15,
        display_order = $16
      WHERE id = $1
      RETURNING *
    `,
    [
      id,
      data.title,
      data.eyebrow,
      data.description,
      data.background_image,
      data.mobile_image,
      data.primary_cta_label,
      data.primary_cta_href,
      data.secondary_cta_label,
      data.secondary_cta_href,
      data.aside_label,
      data.aside_number,
      data.aside_text,
      data.theme,
      data.is_active,
      data.display_order,
    ],
  )
}

export async function deleteAdminHomepageSlide(id: string) {
  await dbQuery('DELETE FROM homepage_slides WHERE id = $1', [id])
  return true
}
