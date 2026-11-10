import {
  isCanonManifestActive,
  type ActiveCanonManifest,
  type CanonManifest,
} from './manifest'
import {
  selectCanonSegments,
  type CanonSelection,
  type ResolvedCanonSource,
  type SkippedCanonSegment,
} from './selection'

/**
 * Решение о том, можно ли отвечать в этом ходе.
 *
 * Три состояния намеренно различаются:
 * - `no_manifest` — активного манифеста нет, чат работает по авторским полям
 *   карточки, как до подключения канона;
 * - `ready` — есть хотя бы один проверенный фрагмент, prompt собирается с ним;
 * - `unavailable` — манифест утверждён и активен, но ни один фрагмент не прошёл
 *   проверку. Это не «нет канона»: отвечать без источников нельзя, поэтому
 *   вызывающий слой обязан вернуть ошибку, а не собирать prompt «по памяти».
 *
 * Отсутствие активного манифеста и отсутствие пригодных источников у активного
 * манифеста — разные ситуации, и смешивать их в `null` нельзя.
 */
export type CanonGateDecision =
  | { status: 'no_manifest' }
  | {
      status: 'ready'
      manifest: ActiveCanonManifest
      selection: CanonSelection
    }
  | {
      status: 'unavailable'
      manifest: ActiveCanonManifest
      skipped: SkippedCanonSegment[]
    }

/**
 * Единственная точка решения. Источники читаются только для активного
 * манифеста: неутверждённый черновик не должен порождать ни одного запроса
 * к БД. Сбой загрузки не перехватывается — он обязан дойти до маршрута и стать
 * `503 canon_unavailable`, а не превратиться в `no_manifest`.
 */
export async function resolveCanonGate(input: {
  manifest: CanonManifest | null
  loadSources: (chapterIds: readonly string[]) => Promise<readonly ResolvedCanonSource[]>
  maxTotalChars?: number
}): Promise<CanonGateDecision> {
  const { manifest } = input
  if (!isCanonManifestActive(manifest)) return { status: 'no_manifest' }

  const chapterIds = [...new Set(manifest.segments.map((segment) => segment.chapterId))]
  const sources = chapterIds.length > 0 ? await input.loadSources(chapterIds) : []

  const selection = selectCanonSegments({
    manifest,
    scope: manifest.scope,
    sources,
    maxTotalChars: input.maxTotalChars,
  })

  if (selection.included.length === 0) {
    return { status: 'unavailable', manifest, skipped: selection.skipped }
  }

  return { status: 'ready', manifest, selection }
}
