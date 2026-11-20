import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { Client } from 'pg'
import { requireE2eDatabaseUrl } from './setup/environment'
import { pgConfig } from './setup/pg'

test.describe('Персонажи публичного релиза', () => {
  test('карточки и JSON-LD сохраняют роли, порядок связей и доступность чата', async ({ page }) => {
    const slug = `e2e-release-characters-${randomUUID()}`
    const releaseId = randomUUID()
    const first = `${slug}-first`
    const second = `${slug}-second`
    const city = `${slug}-city`
    const unrelated = `${slug}-unrelated`
    const secret = `${slug}-private-system-role`
    const databaseUrl = requireE2eDatabaseUrl()
    const client = new Client(pgConfig(databaseUrl))
    await client.connect()

    try {
      await client.query(
        `INSERT INTO releases (id, title, slug, status) VALUES ($1, 'Test release', $2, 'published')`,
        [releaseId, slug],
      )
      await client.query(
        `INSERT INTO characters (name, slug, character_type, reply_mode, can_receive_messages, system_role)
         VALUES ('First character', $1, 'person', 'ai_auto', TRUE, $5),
                ('Second character', $2, 'person', 'hybrid', TRUE, $5),
                ('City', $3, 'city', 'disabled', FALSE, ''),
                ('Unrelated character', $4, 'person', 'ai_auto', TRUE, $5)`,
        [first, second, city, unrelated, secret],
      )
      for (const characterSlug of [first, city, second]) {
        await client.query(
          `INSERT INTO release_characters (release_id, character_id, role)
           SELECT $1, id, 'main' FROM characters WHERE slug = $2`,
          [releaseId, characterSlug],
        )
      }
      const { rows: links } = await client.query<{ character_id: string }>(
        'SELECT release_id, character_id, role FROM release_characters WHERE release_id = $1',
        [releaseId],
      )
      const { rows: people } = await client.query<{ id: string; slug: string; name: string }>(
        "SELECT id, slug, name FROM characters WHERE slug = ANY($1) AND character_type = 'person'",
        [[first, second, city]],
      )
      const peopleById = new Map(people.map(person => [person.id, person]))
      const ordered = links.flatMap(link => {
        const person = peopleById.get(link.character_id)
        return person ? [person] : []
      })
      expect(ordered).toHaveLength(2)

      const response = await page.goto(`/release/${slug}`)
      expect(response?.status()).toBe(200)
      expect(await response?.text()).not.toContain(secret)
      const characters = page.locator('#release-characters')
      await expect(characters.getByRole('heading', { level: 3 })).toHaveText(ordered.map(person => person.name))
      await expect(characters.getByText('Главный герой', { exact: true })).toHaveCount(2)
      await expect(characters.getByRole('link', { name: 'Поговорить' })).toHaveAttribute('href', `/characters/${first}/chat`)

      const schemas = page.locator('script[type="application/ld+json"]')
      const readWork = async () => (await schemas.allTextContents())
        .map(content => JSON.parse(content))
        .find(schema => schema['@type'] === 'CreativeWork')
      expect(await readWork()).toMatchObject({
        character: ordered.map(person => ({ '@type': 'Person', name: person.name })),
        about: { '@type': 'Person', name: ordered[0].name },
      })

      await client.query('DELETE FROM release_characters WHERE release_id = $1', [releaseId])
      expect((await page.reload())?.status()).toBe(200)
      await expect(characters).toHaveCount(0)
      const emptyWork = await readWork()
      expect(emptyWork).toBeDefined()
      expect(emptyWork).not.toHaveProperty('character')
      expect(emptyWork).not.toHaveProperty('about')
    } finally {
      try {
        await client.query('DELETE FROM releases WHERE id = $1', [releaseId])
        await client.query('DELETE FROM characters WHERE slug = ANY($1)', [[first, second, city, unrelated]])
      } finally {
        await client.end()
      }
    }
  })
})
