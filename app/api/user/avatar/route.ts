import { NextRequest, NextResponse } from 'next/server'
import { apiHandler } from '@/lib/api-handler'
import { getCurrentUser } from '@/lib/server/session'
import { handleImageUpload } from '@/lib/server/image-upload'
import { checkRateLimit, rateLimitResponse } from '@/lib/server/rate-limit'

async function handler(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Загрузка доступна любому читателю, а не только studio-ролям — держим лимит
  const limit = await checkRateLimit({
    bucket: 'user-avatar',
    subject: user.id,
    limit: 10,
    windowSeconds: 3600,
  })
  if (!limit.allowed) return rateLimitResponse(limit)

  return handleImageUpload(request)
}

export const POST = apiHandler(handler)
