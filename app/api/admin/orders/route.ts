import { NextRequest, NextResponse } from 'next/server'
import { requireStudioAdminSession } from '@/lib/server/studio-auth'
import { dbQuery } from '@/lib/db'
import { Order } from '@/lib/types'
import { apiHandler } from '@/lib/api-handler'

export const dynamic = 'force-dynamic'

async function getAdminOrders(_request: NextRequest) {
  const session = await requireStudioAdminSession()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orders = await dbQuery<Order>(
    `
      SELECT
        id,
        customer_name,
        customer_email,
        customer_phone,
        customer_address,
        items,
        total::float8 AS total,
        status,
        notes,
        created_at,
        updated_at
      FROM orders
      ORDER BY created_at DESC
    `,
  )

  return NextResponse.json(orders)
}

export const GET = apiHandler(getAdminOrders)