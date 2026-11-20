import { expect, test } from '@playwright/test'
import { formatStudioDate } from '@/lib/studio/format-studio-date'

for (const timeZone of ['UTC', 'Europe/Moscow', 'America/New_York', 'Europe/Berlin']) {
  test(`Studio date formatting in ${timeZone}`, () => {
    const previousTimeZone = process.env.TZ
    process.env.TZ = timeZone
    try {
      expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(timeZone)
      const expected = new Intl.DateTimeFormat('ru-RU', {
        timeZone,
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
      const instant = new Date('2026-11-19T23:05:00Z')

      expect(formatStudioDate('2026-11-19T23:05:00Z')).toBe(expected.format(instant))
      expect(formatStudioDate('2026-11-20T02:05:00+03:00')).toBe(expected.format(instant))
      expect(formatStudioDate('2026-03-29T01:05:00Z')).toBe(expected.format(new Date(Date.UTC(2026, 2, 29, 1, 5))))
      expect(formatStudioDate('2026-11-19')).toBe(expected.format(new Date(Date.UTC(2026, 10, 19))))
      expect(formatStudioDate('2026-11-19T23:05:00')).toBe(expected.format(new Date(2026, 10, 19, 23, 5)))

      // These runtime values are outside the public string signature.
      expect(formatStudioDate(null as unknown as string)).toBe(expected.format(new Date(0)))
      expect(formatStudioDate(undefined as unknown as string)).toBe('Invalid Date')
      expect(formatStudioDate('')).toBe('Invalid Date')
      expect(formatStudioDate('not a date')).toBe('Invalid Date')
    } finally {
      if (previousTimeZone === undefined) delete process.env.TZ
      else process.env.TZ = previousTimeZone
    }
  })
}
