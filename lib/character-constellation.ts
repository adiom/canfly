import type { CharacterPostWithCharacter } from '@/lib/types'

/**
 * Узел орбитального поля. Дискриминированное объединение: `kind` определяет,
 * какие поля доступны. Используется и на сервере (для сборки `nodes` пропом
 * в `<CharacterConstellation>`), и на клиенте (внутри самого компонента).
 *
 * Не-клиентский модуль: `'use client'` в файле компонента не должен затягивать
 * чистую логику в client bundle — иначе её нельзя вызвать с сервера.
 */
export type ConstellationNode =
  | {
      kind: 'release'
      id: string
      title: string
      href: string
      /** Чем больше, тем ближе к центру */
      weight: number
      role: 'main' | 'supporting' | 'cameo'
    }
  | {
      kind: 'relation'
      id: string
      title: string
      subtitle: string | null
      href: string
      weight: number
    }
  | {
      kind: 'post'
      id: string
      title: string
      excerpt: string
      href: string
      weight: number
    }

/**
 * Сборка узлов из сырых данных страницы. Постов берётся максимум 6 — больше
 * = шум на поле. Релизы с `role = 'main'` притягиваются к центру, `cameo` —
 * к внешнему кольцу.
 */
export function buildConstellationNodes(input: {
  releases: {
    release_id: string
    release_slug: string
    release_title: string
    role: 'main' | 'supporting' | 'cameo'
  }[]
  relationships: {
    id: string
    related_slug: string
    related_name: string
    description: string | null
  }[]
  posts: CharacterPostWithCharacter[]
}): ConstellationNode[] {
  const nodes: ConstellationNode[] = []

  for (const rel of input.releases) {
    nodes.push({
      kind: 'release',
      id: `rel:${rel.release_id}`,
      title: rel.release_title,
      href: `/release/${rel.release_slug}`,
      role: rel.role,
      weight: rel.role === 'main' ? 1 : rel.role === 'supporting' ? 0.55 : 0.3,
    })
  }

  for (const rel of input.relationships) {
    nodes.push({
      kind: 'relation',
      id: `c:${rel.id}`,
      title: rel.related_name,
      subtitle: rel.description,
      href: `/characters/${rel.related_slug}`,
      weight: Math.min(1, 0.35 + (rel.description?.length ?? 0) / 220),
    })
  }

  for (const post of input.posts.slice(0, 6)) {
    const firstLine = (post.content ?? '').split('\n')[0]?.slice(0, 80) ?? ''
    nodes.push({
      kind: 'post',
      id: `p:${post.id}`,
      title: firstLine || 'Запись',
      excerpt: (post.content ?? '').slice(0, 140),
      href: `/characters#posts`,
      weight: 0.4,
    })
  }

  return nodes
}
