'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { requireStudioAdminSession } from '@/lib/server/studio-auth'
import {
  createAdminHomepageSlide,
  deleteAdminHomepageSlide,
  updateAdminHomepageSlide,
  type SlideData,
} from '@/lib/homepage-slide-store'
import type { HomepageSlideTheme } from '@/lib/types'

type ActionResponse = { error: string } | { ok: true }

async function requireAdmin() {
  const session = await requireStudioAdminSession()
  if (!session) redirect('/admin/login')
  return session
}

const THEMES: HomepageSlideTheme[] = ['atelier', 'night-city', 'pvz', 'volga', 'dreams']

const slideSchema = z.object({
  title: z.string().min(1, 'Заголовок обязателен'),
  eyebrow: z.string(),
  description: z.string(),
  background_image: z.string(),
  mobile_image: z.string(),
  primary_cta_label: z.string(),
  primary_cta_href: z.string(),
  secondary_cta_label: z.string(),
  secondary_cta_href: z.string(),
  aside_label: z.string(),
  aside_number: z.string(),
  aside_text: z.string(),
  theme: z.enum(THEMES as [HomepageSlideTheme, ...HomepageSlideTheme[]]),
  is_active: z.boolean(),
  display_order: z.number(),
})

function parseSlideFormData(formData: FormData) {
  const get = (key: string) => {
    const value = formData.get(key)
    return typeof value === 'string' ? value : ''
  }

  const theme = get('theme')
  return {
    title: get('title'),
    eyebrow: get('eyebrow'),
    description: get('description'),
    background_image: get('background_image'),
    mobile_image: get('mobile_image'),
    primary_cta_label: get('primary_cta_label'),
    primary_cta_href: get('primary_cta_href'),
    secondary_cta_label: get('secondary_cta_label'),
    secondary_cta_href: get('secondary_cta_href'),
    aside_label: get('aside_label'),
    aside_number: get('aside_number'),
    aside_text: get('aside_text'),
    theme: (THEMES.includes(theme as HomepageSlideTheme) ? theme : 'atelier') as HomepageSlideTheme,
    is_active: formData.get('is_active') === 'on',
    display_order: Number(get('display_order') || 0),
  }
}

function toSlideData(parsed: z.infer<typeof slideSchema>): SlideData {
  const nullable = (value: string) => (value.length > 0 ? value : null)

  return {
    title: parsed.title,
    eyebrow: nullable(parsed.eyebrow),
    description: nullable(parsed.description),
    background_image: nullable(parsed.background_image),
    mobile_image: nullable(parsed.mobile_image),
    primary_cta_label: nullable(parsed.primary_cta_label),
    primary_cta_href: nullable(parsed.primary_cta_href),
    secondary_cta_label: nullable(parsed.secondary_cta_label),
    secondary_cta_href: nullable(parsed.secondary_cta_href),
    aside_label: nullable(parsed.aside_label),
    aside_number: nullable(parsed.aside_number),
    aside_text: nullable(parsed.aside_text),
    theme: parsed.theme,
    is_active: parsed.is_active,
    display_order: parsed.display_order,
  }
}

function validate(formData: FormData): { error: string } | { data: SlideData } {
  const parsed = slideSchema.safeParse(parseSlideFormData(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Ошибка валидации' }
  }
  return { data: toSlideData(parsed.data) }
}

export async function createSlideAction(formData: FormData): Promise<ActionResponse> {
  await requireAdmin()

  const result = validate(formData)
  if ('error' in result) return result

  await createAdminHomepageSlide(result.data)
  revalidatePath('/admin/slider')
  revalidatePath('/')
  return { ok: true }
}

export async function updateSlideAction(id: string, formData: FormData): Promise<ActionResponse> {
  await requireAdmin()

  const result = validate(formData)
  if ('error' in result) return result

  await updateAdminHomepageSlide(id, result.data)
  revalidatePath('/admin/slider')
  revalidatePath('/')
  return { ok: true }
}

export async function deleteSlideAction(id: string): Promise<ActionResponse> {
  await requireAdmin()
  await deleteAdminHomepageSlide(id)
  revalidatePath('/admin/slider')
  revalidatePath('/')
  return { ok: true }
}
