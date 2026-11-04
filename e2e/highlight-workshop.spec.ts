import { expect, test } from '@playwright/test'
import { resolveAnchor } from '@/lib/highlights/anchor'

test.describe('Мастерская highlights', () => {
  test('находит перемещённый фрагмент и не угадывает неоднозначный', () => {
    const anchor = { start: 0, end: 6, exact: 'строка', prefix: 'вторая ', suffix: ' здесь' }
    const text = 'первая строка здесь; вторая строка здесь'
    expect(resolveAnchor(text, anchor)).toMatchObject({ start: text.lastIndexOf('строка'), status: 'moved' })
    expect(resolveAnchor(text, { ...anchor, prefix: '', suffix: '' })).toBeNull()
  })

  test('личные операции требуют входа', async ({ request }) => {
    const id = '00000000-0000-4000-8000-000000000001'
    expect((await request.get('/api/chapter-highlights/collection')).status()).toBe(401)
    expect((await request.put(`/api/chapter-highlights/${id}/publication`, { data: {} })).status()).toBe(401)
    expect((await request.post('/api/highlights/explain', { data: {} })).status()).toBe(401)
    expect((await request.get('/api/chapter-highlights/not-a-uuid/workshop')).status()).toBe(400)
  })
})
