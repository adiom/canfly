import { NextRequest, NextResponse } from 'next/server'
import { requireStudioAdminSession } from '@/lib/server/studio-auth'
import { handleImageUpload } from '@/lib/server/image-upload'
import { apiHandler } from '@/lib/api-handler'

async function postUpload(request: NextRequest) {
  const session = await requireStudioAdminSession()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return handleImageUpload(request)
}

export const POST = apiHandler(postUpload)
