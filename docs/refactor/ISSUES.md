# Реестр задач Canfly после консолидации

Снимок: 2026-11-20. В исходном GitHub эти Issues были открыты на момент экспорта.

Все пункты ниже **сохраняются как нерешённый backlog**. Закрытие GitHub Issue при переносе в этот реестр **не означает исправления**. Текст и метаданные оригинала сохранены в [архиве JSON](archive/issues-open-2026-11-20.json), исходная дискуссия доступна по ссылкам.

Обработанные кодом ветки 19 ноября: #73–#77 (проверки перед принятием ещё нужны). Issue #44–#47 потенциально затронуты транзакционным сохранением, но **не помечены решёнными** до проверки конкретных критериев.

## Безопасность, доступ и ошибки API

| Issue | Задача | Текущее состояние |
|---|---|---|
| [#50](https://github.com/adiom/canfly/issues/50) | postgres/: дублирующиеся номера миграций (007, 014) и вторая последовательность в migrations/ | Перенесено в backlog; исправление не подтверждено |
| [#49](https://github.com/adiom/canfly/issues/49) | /api/user/session глотает ошибки БД и отвечает 200 «не авторизован» | Перенесено в backlog; исправление не подтверждено |
| [#43](https://github.com/adiom/canfly/issues/43) | Magic link: лимит только по email — рассылка писем и рост magic_tokens без предела | Перенесено в backlog; исправление не подтверждено |
| [#42](https://github.com/adiom/canfly/issues/42) | /api/search: нет рейт-лимита, три LIKE '%…%' без индексов → исчерпание пула | Перенесено в backlog; исправление не подтверждено |
| [#41](https://github.com/adiom/canfly/issues/41) | /api/search: нечисловой ?limit доходит до SQL как NaN → 500 | Исправлено в refactor; unit-тесты пройдены, ещё не в main |
| [#38](https://github.com/adiom/canfly/issues/38) | /api/cron/cleanup: без apiHandler, прямой getPool() вместо dbQuery, метод в AGENTS.md указан неверно | Перенесено в backlog; исправление не подтверждено |
| [#35](https://github.com/adiom/canfly/issues/35) | /api/feedback: обращения не сохраняются (только console.info), PII в логах, нет лимитов | Перенесено в backlog; исправление не подтверждено |
| [#34](https://github.com/adiom/canfly/issues/34) | Стена персонажа: POST без рейт-лимита (+ revalidatePath на каждый пост) | Перенесено в backlog; исправление не подтверждено |
| [#33](https://github.com/adiom/canfly/issues/33) | version-history: dangerouslySetInnerHTML из несанитизированного content.slice(0,500) | Перенесено в backlog; исправление не подтверждено |
| [#32](https://github.com/adiom/canfly/issues/32) | news.ts: контент новостей пишется без санитизации, withSafeContent только в одной из трёх функций чтения | Перенесено в backlog; исправление не подтверждено |
| [#31](https://github.com/adiom/canfly/issues/31) | setUserRoles: DELETE+INSERT без транзакции — окно без ролей и потеря прав при сбое | Перенесено в backlog; исправление не подтверждено |
| [#30](https://github.com/adiom/canfly/issues/30) | deleteEditorialNote игнорирует userId/isAdmin, но JSDoc обещает проверку прав — заготовка под IDOR | Перенесено в backlog; исправление не подтверждено |
| [#28](https://github.com/adiom/canfly/issues/28) | /api/characters/chat: нет zod, пустое тело → 500, длина сообщения не ограничена, авторизация после запроса в БД | Перенесено в backlog; исправление не подтверждено |
| [#27](https://github.com/adiom/canfly/issues/27) | apiHandler клонирует и вычитывает тело ответа на 5xx — опасно для стриминговых роутов | Перенесено в backlog; исправление не подтверждено |
| [#26](https://github.com/adiom/canfly/issues/26) | /api/reading-progress: нет zod, не-UUID и пустое тело дают 500, глава не сверяется с изданием | Перенесено в backlog; исправление не подтверждено |
| [#25](https://github.com/adiom/canfly/issues/25) | chapter-highlights: LIMIT собирается интерполяцией, ?limit=1.5 → 500, ?limit=abc отключает лимит | Перенесено в backlog; исправление не подтверждено |
| [#23](https://github.com/adiom/canfly/issues/23) | /api/releases/download/markdown: не обёрнут в apiHandler, не проверяет связь издания с релизом | Перенесено в backlog; исправление не подтверждено |
| [#21](https://github.com/adiom/canfly/issues/21) | Код подтверждения email не отправляется: addEmail пишет код в БД, но письма нет | Перенесено в backlog; исправление не подтверждено |
| [#20](https://github.com/adiom/canfly/issues/20) | Загрузка картинок к постам персонажей идёт мимо image-upload.ts (нет проверки сигнатуры, размера) | Перенесено в backlog; исправление не подтверждено |
| [#19](https://github.com/adiom/canfly/issues/19) | Проверка TLS-сертификата БД отключена: ssl.rejectUnauthorized=false перекрывает sslmode=verify-full | Перенесено в backlog; исправление не подтверждено |

## Целостность данных и сохранение

| Issue | Задача | Текущее состояние |
|---|---|---|
| [#48](https://github.com/adiom/canfly/issues/48) | /user/[slug]: владелец не видит свою полку (условие !isOwner зеркально смыслу) | Перенесено в backlog; исправление не подтверждено |
| [#47](https://github.com/adiom/canfly/issues/47) | restoreChapterVersion: два запроса без транзакции, текущий текст главы не архивируется | Перенесено в backlog; исправление не подтверждено |
| [#46](https://github.com/adiom/canfly/issues/46) | restoreChapterVersion считает word_count без снятия HTML-тегов — расходится с сохранением | Перенесено в backlog; исправление не подтверждено |
| [#45](https://github.com/adiom/canfly/issues/45) | createChapterVersion: version_number через SELECT-then-INSERT без UNIQUE — дубликаты версий | Перенесено в backlog; исправление не подтверждено |
| [#44](https://github.com/adiom/canfly/issues/44) | chapter_versions хранит отсанитизированный HTML — ложные версии и невосстановимый исходник | Перенесено в backlog; исправление не подтверждено |
| [#39](https://github.com/adiom/canfly/issues/39) | makeUniqueEditionSlugGlobal: гонка SELECT→INSERT, цикл до 100000, LIKE без экранирования | Перенесено в backlog; исправление не подтверждено |
| [#29](https://github.com/adiom/canfly/issues/29) | Сохранение настроек издания сбрасывает is_primary в false (updateEdition — полнострочный UPDATE) | Перенесено в backlog; исправление не подтверждено |

## Производительность и конкурентность

| Issue | Задача | Текущее состояние |
|---|---|---|
| [#36](https://github.com/adiom/canfly/issues/36) | use-column-pagination: document.fonts.ready.then(measure) не отменяется в cleanup | Перенесено в backlog; исправление не подтверждено |
| [#13](https://github.com/adiom/canfly/issues/13) | Кэширование частых запросов к БД | Перенесено в backlog; исправление не подтверждено |
| [#5](https://github.com/adiom/canfly/issues/5) | Neon холодный старт: первый запрос 5+ секунд | Перенесено в backlog; исправление не подтверждено |

## Другие подтверждённые дефекты

| Issue | Задача | Текущее состояние |
|---|---|---|
| [#40](https://github.com/adiom/canfly/issues/40) | Уборка: слипшаяся строка в lib/db.ts:5 и недостижимое условие в proxy.ts:66 | Перенесено в backlog; исправление не подтверждено |
| [#37](https://github.com/adiom/canfly/issues/37) | /api/chapters/rate отвечает 200 status:retired вместо 410, как /api/orders | Исправлено в refactor; unit-тест пройден, ещё не в main |
| [#24](https://github.com/adiom/canfly/issues/24) | Ридер: нечисловой номер главы в URL даёт 500 вместо 404 (parseInt → NaN) | Перенесено в backlog; исправление не подтверждено |

## Продуктовые задачи и UX

| Issue | Задача | Текущее состояние |
|---|---|---|
| [#51](https://github.com/adiom/canfly/issues/51) | games | Перенесено в backlog; исправление не подтверждено |
| [#17](https://github.com/adiom/canfly/issues/17) | Поведение слайдера | Перенесено в backlog; исправление не подтверждено |
| [#12](https://github.com/adiom/canfly/issues/12) | Полнотекстовый поиск по главам релизов | Перенесено в backlog; исправление не подтверждено |
| [#10](https://github.com/adiom/canfly/issues/10) | Реакции к постам персонажей (лайки/комментарии) | Перенесено в backlog; исправление не подтверждено |
| [#9](https://github.com/adiom/canfly/issues/9) | Закладки (bookmarks) для релизов | Перенесено в backlog; исправление не подтверждено |
| [#8](https://github.com/adiom/canfly/issues/8) | Система комментирования релизов | Перенесено в backlog; исправление не подтверждено |
