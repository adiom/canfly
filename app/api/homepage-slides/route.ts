import { NextRequest, NextResponse } from 'next/server'
import { getPublicHomepageSlides } from '@/lib/homepage-slide-store'
import { apiHandler } from '@/lib/api-handler'

export const dynamic = 'force-dynamic'

async function getHomepageSlides(_request: NextRequest) {
  const slides = await getPublicHomepageSlides()

  return NextResponse.json(slides)
}

export const GET = apiHandler(getHomepageSlides)