# MCP: доступ и подключение клиентов

Canfly отдаёт MCP-сервер по адресу `/api/mcp`. Он открывает Studio-операции:
чтение и правку релизов, изданий, глав, персонажей, мест и серий. Доступ есть
только у действующего администратора — авторы и публичные клиенты не проходят
проверку.

## Модель доступа

Поддерживаются два способа аутентификации:

| Способ | Для чего | Проверка |
|--------|----------|----------|
| `MCP_TOKEN` | локальная отладка, CI, MCP Inspector, скрипты | статический Bearer-токен из env |
| OAuth 2.1 | ChatGPT, Claude, Cursor, OpenCode | access token + живой `is_admin = true` + email в `MCP_OAUTH_ALLOWED_EMAILS` |

OAuth-токен проверяется на каждом запросе, поэтому снятие роли администратора
или удаление email из allowlist действует немедленно. Статический `MCP_TOKEN`
не привязан к пользователю: обращайтесь с ним как с паролем.

Без `MCP_TOKEN` и без настроенного OAuth `/api/mcp` отвечает `503`. Без
корректного токена — `401`; при включённом OAuth ответ содержит
`WWW-Authenticate` с адресом метаданных ресурса, и клиент сам начинает OAuth.

## Переменные окружения

```bash
# Статический доступ (локально, CI, Inspector). Не обязателен, если настроен OAuth.
MCP_TOKEN=

# OAuth включается только когда заданы все три переменные и список непустой.
AUTH_SECRET=
NEXT_PUBLIC_BASE_URL=https://canfly.org
MCP_OAUTH_ALLOWED_EMAILS=admin@example.com

# Необязательно: дополнительные точные redirect URI через запятую.
MCP_OAUTH_EXTRA_REDIRECT_URIS=

# Необязательно: хосты, с которых разрешено читать Client ID Metadata Document.
MCP_OAUTH_CLIENT_METADATA_HOSTS=
```

Встроенный allowlist callback-адресов:

- ChatGPT: `https://chatgpt.com/connector_platform_oauth_redirect`,
  `https://chatgpt.com/connector/oauth/<id>`,
  `https://chat.openai.com/aip/<id>/oauth/callback`;
- Claude: `https://claude.ai/api/mcp/*`, `https://claude.com/api/mcp/*`;
- локальные клиенты: любой `http://localhost:<port>`, `127.0.0.1` или `[::1]`.

Всё остальное подключается только через `MCP_OAUTH_EXTRA_REDIRECT_URIS`.

## Миграция

OAuth-таблицы и аудит создаются миграцией `postgres/031_mcp_oauth_clients.sql`.
Примените её до включения OAuth. Миграция только добавляет колонки, индексы и
таблицу `mcp_oauth_events`; существующие данные не меняются.

## Подключение клиентов

### ChatGPT

1. Включите OAuth-переменные и примените миграцию.
2. Settings → Connectors → Add custom connector.
3. URL: `https://canfly.org/api/mcp`.
4. Пройдите вход в canfly. Согласие запрашивается каждый раз, грант живёт
   30 дней. Отозвать доступ можно в настройках коннектора.

ChatGPT использует Client ID Metadata Document и Dynamic Client Registration;
оба механизма поддержаны. Client ID может быть HTTPS-URL — документ читается
только с хостов из allowlist.

### Claude

1. Settings → Connectors → Add custom connector.
2. URL: `https://canfly.org/api/mcp`.
3. Войдите в canfly и подтвердите доступ.

Callback Claude разрешён по префиксу пути `/api/mcp/`, поэтому изменения
внутреннего пути у Claude не ломают подключение. Если Claude начнёт отдавать
callback с другим путём, добавьте точный адрес в
`MCP_OAUTH_EXTRA_REDIRECT_URIS`.

### Cursor и OpenCode

Клиенты, которые не умеют OAuth, могут использовать статический токен:

```jsonc
// ~/.cursor/mcp.json
{
  "mcpServers": {
    "canfly": {
      "url": "https://canfly.org/api/mcp",
      "headers": { "Authorization": "Bearer <MCP_TOKEN>" }
    }
  }
}
```

```jsonc
// opencode.json
{
  "mcp": {
    "canfly": {
      "type": "remote",
      "url": "https://canfly.org/api/mcp",
      "headers": { "Authorization": "Bearer <MCP_TOKEN>" }
    }
  }
}
```

Для локального сервера используйте `http://localhost:3000/api/mcp`. Клиенты с
поддержкой OAuth (включая свежий `mcp-remote`) можно подключать по URL без
заголовка — они прочитают `WWW-Authenticate` и пройдут авторизацию.

### Inspector и скрипты

```bash
npx @modelcontextprotocol/inspector
# Transport: Streamable HTTP
# URL: http://localhost:3000/api/mcp
# Header: Authorization: Bearer <MCP_TOKEN>
```

```bash
curl -s http://localhost:3000/api/mcp \
  -H "Authorization: Bearer $MCP_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## Инструменты

**Релизы и издания**

- `canfly_list_releases`, `canfly_get_release`, `canfly_create_release`,
  `canfly_update_release`, `canfly_set_release_status`
- `canfly_get_edition`, `canfly_create_edition`, `canfly_update_edition`
- `canfly_list_release_characters`, `canfly_set_release_characters`
- `canfly_list_release_series`, `canfly_set_release_series`
- `canfly_list_release_places`, `canfly_set_release_places`

**Главы**

- `canfly_list_chapters`, `canfly_get_chapter`, `canfly_create_chapter`,
  `canfly_update_chapter`
- `canfly_reorder_chapters`, `canfly_publish_chapter`
- `canfly_list_chapter_versions`, `canfly_restore_chapter_version`

**Персонажи и места**

- `canfly_list_characters`, `canfly_get_character`, `canfly_create_character`,
  `canfly_update_character`, `canfly_update_character_passport`
- `canfly_list_places`, `canfly_get_place`, `canfly_create_place`,
  `canfly_update_place`, `canfly_delete_place`
- `canfly_get_place_characters`, `canfly_list_character_places`,
  `canfly_set_character_places`
- `canfly_list_character_relationships`,
  `canfly_search_characters_for_relationship`,
  `canfly_upsert_character_relationship`, `canfly_delete_character_relationship`

**Серии и поиск**

- `canfly_list_series`, `canfly_get_series`, `canfly_create_series`,
  `canfly_update_series`
- `canfly_search`

`canfly_list_*` и `canfly_search` принимают `limit`/`offset`. Мутации частичные:
непереданное поле сохраняет текущее значение, явный `null` очищает поле.
`canfly_set_release_characters`, `canfly_set_release_series`,
`canfly_set_release_places` и `canfly_set_character_places` атомарно заменяют
весь список; пустой массив очищает связи.

Новых операций удаления релизов, изданий, глав, персонажей и серий нет.
`canfly_delete_place` и `canfly_delete_character_relationship` существовали
раньше и удаляют только место или связь.


## Яндекс Метрика: статистика через MCP (только чтение)

Счётчик Canfly: `42420764`. MCP-тулы `canfly_metrika_*` получают
агрегированные отчёты через Yandex Metrica API. Доступ наследует существующую
admin-only авторизацию MCP; публичного API для статистики нет.

### Первое подключение (MVP)

1. В Yandex OAuth создайте приложение с единственным разрешением `metrika:read`.
   Для Canfly Metrika Analyst уже используется Client ID
   `52ee1353d68f43dd88fcc41400a1c229`.
2. Откройте в браузере под аккаунтом с доступом к счётчику:
   `https://oauth.yandex.ru/authorize?response_type=token&client_id=52ee1353d68f43dd88fcc41400a1c229`.
   Текущий callback `https://oauth.yandex.ru/verification_code` предназначен для
   **ручной выдачи токена** и для этого MVP подходит.
3. Сохраните выданный токен **непосредственно в защищённой переменной окружения
   Vercel** `YANDEX_METRIKA_ACCESS_TOKEN` (только сервер; без `NEXT_PUBLIC_`).
   Никогда не отправляйте токен в чат, GitHub, клиентский код или логи.
4. Переразверните проект и вызовите `canfly_metrika_counter` из
   авторизованного MCP-клиента. Запросы к API без токена не выполняются.

Не требуется `metrika:write`; ни один тул не меняет счётчики или данные.
При отзыве/истечении токена необходимо повторно авторизоваться и заменить
серверный секрет; автоматическое обновление токена здесь пока не реализовано.

### Доступные read-only тулы

- `canfly_metrika_counter` — проверка доступности счётчика;
- `canfly_metrika_overview` — показатели за период;
- `canfly_metrika_daily` — дневная динамика;
- `canfly_metrika_sources` — источники трафика;
- `canfly_metrika_entrances` — страницы входа;
- `canfly_metrika_devices` — типы устройств.

Статистика может быть семплированной; в ответе сохраняются служебные поля API.
Для аналитических рекомендаций нужно сравнивать сопоставимые периоды,
исключать неполные текущие дни и не выводить поисковые позиции из посещаемости.

Справочник: https://yandex.ru/dev/metrika/ru/stat/ .

## Безопасность и сопровождение

- HTML глав очищается на сервере при записи и чтении.
- Write-тулы пишут строку аудита в server logs; ошибки тулов логируются всегда.
- OAuth-события (`code_issued`, `token_issued`, `refresh_reuse`,
  `token_revoked`, `authorize_denied`) пишутся в `mcp_oauth_events` без токенов
  и email. IP хранится только как усечённый SHA-256.
- Коды живут 5 минут, access token — 1 час, refresh token и грант — 30 дней.
  Повторное использование refresh token отзывает грант.
- `/api/cron/cleanup` удаляет просроченные коды, старые гранты, неиспользуемых
  DCR-клиентов и события старше 180 дней.
- Rate limit: 300 запросов/час на токен, 60 обменов токена/минуту с IP,
  10 регистраций клиента/час с IP.

## Диагностика

| Симптом | Что проверить |
|---------|----------------|
| `503` | не задан ни `MCP_TOKEN`, ни полный набор OAuth-переменных |
| `401` без `WWW-Authenticate` | OAuth выключен: клиент должен слать `MCP_TOKEN` |
| `401` после OAuth | пользователь не admin, email не в allowlist или грант отозван |
| `invalid_client_metadata` | redirect URI не входит в allowlist |
| `invalid_grant` | код истёк, PKCE не совпал, refresh уже использован |
| CIMD не читается | хост клиента не в `MCP_OAUTH_CLIENT_METADATA_HOSTS` |
| `404` на `.well-known` | OAuth выключен или не задан `NEXT_PUBLIC_BASE_URL` |
