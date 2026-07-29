import { NextRequest, NextResponse } from 'next/server'
import { requireStudioSession } from '@/lib/server/studio-auth'
import { handleImageUpload } from '@/lib/server/image-upload'
import { apiHandler } from '@/lib/api-handler'

async function handler(request: NextRequest) {
  const session = await requireStudioSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return handleImageUpload(request)
}

export const POST = apiHandler(handler)
