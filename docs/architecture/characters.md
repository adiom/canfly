# Персонажи и чаты

Проверено по [коммиту](README.md). Каталог и профиль: [`app/characters/`](../../app/characters/); чат: [`app/characters/[slug]/chat/page.tsx`](../../app/characters/[slug]/chat/page.tsx) и [`components/character-chat.tsx`](../../components/character-chat.tsx).

| Поток | API / модуль | Таблицы |
| --- | --- | --- |
| Профиль и связи | [`lib/server/characters.ts`](../../lib/server/characters.ts), [`lib/server/character-relationships.ts`](../../lib/server/character-relationships.ts) | `characters`, `character_relationships`, `release_characters` |
| Подписка/дружба | [`api/characters/[slug]/friendship`](../../app/api/characters/[slug]/friendship/route.ts), [`lib/server/users.ts`](../../lib/server/users.ts) | `character_friendships` |
| История чата | [`api/characters/[slug]/conversation`](../../app/api/characters/[slug]/conversation/route.ts), `users.ts` | `character_conversations`, `character_messages` |
| Генерация ответа | [`api/characters/chat`](../../app/api/characters/chat/route.ts) | `character_messages`, `characters` |
| Стена и посты | [`api/characters/[slug]/wall`](../../app/api/characters/[slug]/wall/route.ts), [`lib/server/character-wall.ts`](../../lib/server/character-wall.ts) | `character_wall_posts`, `character_posts` |

**Факт:** обработчик чата проверяет пользователя и лимит, связывает его с персонажем, сохраняет входящее сообщение, читает историю и вызывает `streamText` из AI SDK. Паспорт и редактор персонажа находятся в [Studio](studio.md). **Гипотеза для будущего аудита:** надёжность сохранения полного ответа при обрыве потока требует отдельного сценарного теста; здесь она не подтверждена.
