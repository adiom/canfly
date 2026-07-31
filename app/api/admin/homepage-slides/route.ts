import { NextRequest, NextResponse } from 'next/server'
import { requireStudioAdminSession } from '@/lib/server/studio-auth'
import {
  createAdminHomepageSlide,
  isHomepageSlidesTableMissing,
  listAdminHomepageSlides,
} from '@/lib/homepage-slide-store'
import { apiHandler } from '@/lib/api-handler'
import { normalizeSlidePayload } from '@/lib/api/normalizers'

export const dynamic = 'force-dynamic'

async function getAdminHomepageSlides(_request: NextRequest) {
  try {
    const session = await requireStudioAdminSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const slides = await listAdminHomepageSlides()

    return NextResponse.json(slides)
  } catch (error) {
    if (isHomepageSlidesTableMissing(error)) {
      return NextResponse.json(
        {
          error:
            'Таблица homepage_slides не создана. Выполните SQL из postgres/schema.sql в Postgres.',
        },
        { status: 424 },
      )
    }

    throw error
  }
}

async function postHomepageSlide(request: NextRequest) {
  try {
    const session = await requireStudioAdminSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const normalized = normalizeSlidePayload(body)

    if ('error' in normalized) {
      return NextResponse.json({ error: normalized.error }, { status: 400 })
    }

    const slide = await createAdminHomepageSlide(normalized.data)

    if (!slide) {
      return NextResponse.json({ error: 'Failed to create homepage slide' }, { status: 500 })
    }

    return NextResponse.json(slide, { status: 201 })
  } catch (error) {
    if (isHomepageSlidesTableMissing(error)) {
      return NextResponse.json(
        {
          error:
            'Таблица homepage_slides не создана. Выполните SQL из postgres/schema.sql в Postgres.',
        },
        { status: 424 },
      )
    }

    throw error
  }
}

export const GET = apiHandler(getAdminHomepageSlides)
export const POST = apiHandler(postHomepageSlide)