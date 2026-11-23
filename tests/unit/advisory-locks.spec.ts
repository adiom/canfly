import { expect, test } from '@playwright/test'
import { advisoryLockKey, canonicalUuid, canonicalUuidList } from '@/lib/server/advisory-locks'

const uuid = '0f0f0f0f-1111-4222-8333-444444444444'

test('канонизация UUID не зависит от регистра и пробелов', () => {
  expect(canonicalUuid(uuid.toUpperCase())).toBe(uuid)
  expect(canonicalUuid(`  ${uuid.toUpperCase()}  `)).toBe(uuid)
  expect(advisoryLockKey('chapter-lease', uuid.toUpperCase()))
    .toBe(advisoryLockKey('chapter-lease', uuid))
})

test('scope входит в ключ, поэтому chapter/edition/release не сталкиваются', () => {
  const keys = [
    advisoryLockKey('chapter-lease', uuid),
    advisoryLockKey('chapter-composition', uuid),
    advisoryLockKey('release-composition', uuid),
  ]
  expect(new Set(keys).size).toBe(3)
})

test('список UUID дедуплицируется и сортируется по каноническому виду', () => {
  const other = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
  expect(canonicalUuidList([uuid.toUpperCase(), uuid, other])).toEqual([uuid, other].sort())
})
