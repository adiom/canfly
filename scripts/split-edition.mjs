#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import pg from 'pg'

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return {}
  const contents = readFileSync(filePath, 'utf8')
  const env = {}
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    const key = trimmed.slice(0, idx).trim()
    let value = trimmed.slice(idx + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    env[key] = value
  }
  return env
}

function getDatabaseUrl() {
  const env = loadEnvFile(resolve(process.cwd(), '.env.local'))
  return process.env.DATABASE_URL || env.DATABASE_URL || process.env.POSTGRES_URL || env.POSTGRES_URL
}

function isLocalDatabaseUrl(value) {
  try {
    const url = new URL(value)
    return ['localhost', '127.0.0.1', '::1'].includes(url.hostname)
  } catch {
    return false
  }
}

async function ensureUniqueSlug(client, baseSlug) {
  let slug = baseSlug
  let suffix = 2
  while (true) {
    const { rows } = await client.query('SELECT 1 FROM editions WHERE slug = $1 LIMIT 1', [slug])
    if (rows.length === 0) return slug
    slug = `${baseSlug}-${suffix}`
    suffix += 1
  }
}

async function main() {
  const [sourceEditionId, targetEditionId, startIndexArg = '24'] = process.argv.slice(2)
  if (!sourceEditionId) {
    console.error('Использование: node scripts/split-edition.mjs <sourceEditionId> [targetEditionId] [startChapterIndex]')
    process.exit(1)
  }

  const startIndex = Number(startIndexArg)
  if (!Number.isInteger(startIndex) || startIndex < 1) {
    console.error('startChapterIndex должен быть положительным целым числом')
    process.exit(1)
  }

  const databaseUrl = getDatabaseUrl()
  if (!databaseUrl) {
    console.error('DATABASE_URL не задана в окружении или .env.local')
    process.exit(1)
  }

  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: isLocalDatabaseUrl(databaseUrl) ? false : { rejectUnauthorized: false },
  })

  try {
    await client.connect()

    const sourceRes = await client.query(
      `SELECT id, release_id, format, platform, external_url, slug, quality_tier
       FROM editions WHERE id = $1 LIMIT 1`,
      [sourceEditionId],
    )

    if (sourceRes.rows.length === 0) {
      console.error(`Исходное издание не найдено: ${sourceEditionId}`)
      process.exit(1)
    }

    const sourceEdition = sourceRes.rows[0]
    const chaptersRes = await client.query(
      `SELECT id, title, chapter_index
       FROM chapters
       WHERE edition_id = $1 AND chapter_index >= $2
       ORDER BY chapter_index ASC`,
      [sourceEditionId, startIndex],
    )

    if (chaptersRes.rows.length === 0) {
      console.log(`Нет глав с chapter_index >= ${startIndex} в edition ${sourceEditionId}`)
      process.exit(0)
    }

    let finalEditionId = targetEditionId
    let targetEdition = null
    let newEditionCreated = false

    if (targetEditionId) {
      if (targetEditionId === sourceEditionId) {
        console.error('Целевое издание должно отличаться от исходного')
        process.exit(1)
      }
      const targetRes = await client.query(
        `SELECT id, release_id, format, platform, external_url, slug, quality_tier
         FROM editions WHERE id = $1 LIMIT 1`,
        [targetEditionId],
      )
      if (targetRes.rows.length === 0) {
        console.error(`Целевое издание не найдено: ${targetEditionId}`)
        process.exit(1)
      }
      targetEdition = targetRes.rows[0]
      if (targetEdition.format !== sourceEdition.format) {
        console.error('Целевое издание должно иметь тот же формат, что и исходное')
        process.exit(1)
      }
      console.log(`Перенос глав в существующее издание ${targetEdition.id} (slug=${targetEdition.slug})`)
    } else {
      const baseSlug = `${sourceEdition.slug}-part-2`
      const newSlug = await ensureUniqueSlug(client, baseSlug)

      const newEditionRes = await client.query(
        `INSERT INTO editions (release_id, format, platform, external_url, slug, status, is_primary, quality_tier)
         VALUES ($1, $2, $3, $4, $5, 'draft', false, $6)
         RETURNING id`,
        [sourceEdition.release_id, sourceEdition.format, sourceEdition.platform, sourceEdition.external_url, newSlug, sourceEdition.quality_tier ?? 'standard'],
      )

      finalEditionId = newEditionRes.rows[0].id
      targetEdition = { ...sourceEdition, id: finalEditionId, slug: newSlug }
      newEditionCreated = true
      console.log(`Создано новое издание ${finalEditionId} с slug=${newSlug}`)
    }

    const targetIndexRes = await client.query(
      `SELECT MAX(chapter_index) AS max_index
       FROM chapters
       WHERE edition_id = $1`,
      [finalEditionId],
    )
    const maxTargetIndex = targetIndexRes.rows[0]?.max_index ?? 0
    const startTargetIndex = Number.isInteger(maxTargetIndex) ? maxTargetIndex + 1 : 1

    const movedChapterIds = []
    for (const [index, chapter] of chaptersRes.rows.entries()) {
      const newChapterIndex = startTargetIndex + index
      await client.query(
        `UPDATE chapters
         SET edition_id = $1, chapter_index = $2, updated_at = NOW()
         WHERE id = $3`,
        [finalEditionId, newChapterIndex, chapter.id],
      )
      movedChapterIds.push(chapter.id)
    }

    if (movedChapterIds.length > 0) {
      await client.query(
        `UPDATE reading_progress
         SET edition_id = $1
         WHERE chapter_id = ANY($2)`,
        [finalEditionId, movedChapterIds],
      )
    }

    console.log(`Перемещено ${movedChapterIds.length} глав в edition ${finalEditionId}.`)
    if (!targetEditionId) {
      console.log(`Оригинальное издание ${sourceEditionId} теперь содержит только главы до ${startIndex - 1}.`)
    }
  } catch (error) {
    console.error('Ошибка:', error.message)
    process.exit(1)
  } finally {
    await client.end()
  }
}

main()
