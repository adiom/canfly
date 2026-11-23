export type AdvisoryLockScope = 'chapter-lease' | 'chapter-composition' | 'release-composition'

/**
 * PostgreSQL считает UUID в верхнем и нижнем регистре одним значением, но
 * `hashtextextended` получает текст и хеширует его посимвольно. Поэтому все
 * advisory-ключи строятся только из канонического (нижнего) представления.
 */
export function canonicalUuid(value: string): string {
  return value.trim().toLowerCase()
}

export function advisoryLockKey(scope: AdvisoryLockScope, id: string): string {
  return `canfly:${scope}:${canonicalUuid(id)}`
}

export function canonicalUuidList(ids: string[]): string[] {
  return [...new Set(ids.map(canonicalUuid))].sort()
}
