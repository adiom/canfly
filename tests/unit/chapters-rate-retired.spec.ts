import { expect, test } from '@playwright/test'
import { GET, POST } from '@/app/api/chapters/rate/route'

test('retired chapter rating API uses HTTP 410 for both methods', async () => {
  for (const handler of [GET, POST]) {
    const response = await handler()
    expect(response.status).toBe(410)
    expect(response.ok).toBe(false)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(await response.json()).toMatchObject({ status: 'retired' })
  }
})
