# Пользователи и авторизация

Проверено по [коммиту](README.md). **Факт:** вход настраивается в [auth.config.ts](../../app/%28auth%29/auth.config.ts), обработчик NextAuth — в [route.ts](../../app/%28auth%29/api/auth/%5B...nextauth%5D/route.ts). Серверная сессия читается через [`lib/server/session.ts`](../../lib/server/session.ts). [`proxy.ts`](../../proxy.ts) выполняет ранние редиректы для `/user`, `/profile`, `/studio`, `/admin`; окончательная проверка в Studio выполняется также через [`lib/server/studio-auth.ts`](../../lib/server/studio-auth.ts).

| Маршрут/операция | Модули | Таблицы |
| --- | --- | --- |
| `/login`, OAuth, magic link | `auth.config.ts`, [`lib/server/magic-token.ts`](../../lib/server/magic-token.ts) | `users`, `linked_accounts`, `magic_tokens` |
| `/user`, `/user/[slug]`, настройки | [`lib/server/user-profile.ts`](../../lib/server/user-profile.ts), [`lib/actions/user-profile.ts`](../../lib/actions/user-profile.ts), [`lib/actions/account-settings.ts`](../../lib/actions/account-settings.ts) | `users`, `reading_progress`, `chapter_highlights`, `character_friendships` |
| Роли и доступ | `session.ts`, `studio-auth.ts`, [`lib/server/users.ts`](../../lib/server/users.ts) | `users.public_role`, `users.is_admin`, `user_roles`, `release_collaborators` |

**Факт:** публичная роль (`reader`/`author`), флаг администратора и системная роль редактора разделены. **План для новых функций:** проверять право доступа при каждой серверной мутации, включая владение конкретным релизом, изданием или главой. Гостевая запись прогресса чтения сейчас отсутствует.

**Факт на 10.11:** `getCurrentUser()` в [session.ts](../../lib/server/session.ts) исключает `is_deleted` пользователей; валидная старая сессия больше не возвращает удалённую учётную запись. Чтение истории чата через GET не создаёт дружбу или разговор.
