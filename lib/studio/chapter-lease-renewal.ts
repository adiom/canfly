import type { ChapterLeaseView } from '@/lib/studio/chapter-lease'

export interface LeaseRenewalResult {
  ok: true
  lease: ChapterLeaseView
}

export type LeaseRenewalOutcome =
  | { status: 'ok'; lease: ChapterLeaseView }
  | { status: 'lost' }
  | { status: 'degraded' }

/**
 * Ошибка сети или авторизации при heartbeat не является успешным продлением.
 * Наружу отдаём явный `degraded`, чтобы UI не показывал ложный успех, а TTL
 * на сервере продолжал работать.
 */
export async function settleLeaseRenewal(
  renew: () => Promise<LeaseRenewalResult | { ok: false; code: string; message?: string }>,
): Promise<LeaseRenewalOutcome> {
  try {
    const result = await renew()
    if (result.ok) return { status: 'ok', lease: result.lease }
    if (result.code === 'lease-lost') return { status: 'lost' }
    return { status: 'degraded' }
  } catch {
    return { status: 'degraded' }
  }
}
