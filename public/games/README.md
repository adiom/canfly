# Canfly Games — стандарт v1

Canfly Games использует **одну публичную SEO-страницу** и **отдельный запуск игрового HTML**.

## Адреса и источник данных

| URL | Назначение | Индексация |
| --- | --- | --- |
| `/games/<slug>` | Страница Next.js с игрой, описанием и связями | По `games.seo_noindex` |
| `/games/<slug>/game.html` | Автономная игра в iframe или отдельной вкладке | `noindex, nofollow` |
| `/studio/games` | Название, обложка, SEO, публикация и связи | Не публичный контент |

**Источник SEO — таблица `games`, а не игровой HTML.** Страница
`app/games/[slug]/page.tsx` читает `seo_title`, `seo_description`,
`seo_noindex` и задаёт canonical `/games/<slug>`. Не создавайте
`public/games/<slug>/index.html`: это неоднозначный адрес рядом с
маршрутом Next.js `/games/[slug]`.

## Папка игры

```text
public/games/my-game/
  game.html             # обязательная точка входа
  style.css
  js/
  fonts/
  assets/
```

- Имя папки — точный `slug` в `games` и Studio.
- Подключайте ресурсы относительно `game.html`: `./js/main.js`, `./style.css`.
  Абсолютный путь от корня разрешён только **с префиксом игры**,
  например `/games/my-game/js/main.js`; `/js/main.js` запрещён.
  Относительные пути удобнее для переноса игр.
- Сам `game.html` содержит базовые `lang`, `charset`, `viewport`,
  `title`, `robots=noindex,nofollow` и canonical на публичную страницу.
  SEO-поля из БД в HTML не копировать.
- В `game.html` остаются только игровая разметка, ресурсы и запуск движка;
  обложка, описание, персонажи и релизы живут в Next.js.
- Не загружайте сторонние скрипты, шрифты или CDN. CSP допускает локальные
  ресурсы; внешние зависимости нужно хранить в папке игры.
- Игра не получает прямой доступ к PostgreSQL и React-контексту сайта.
  Для собственного прогресса пока можно использовать `localStorage` с
  **именованными ключами игры** (например `canfly:still-road:save:v1`).
  Для истории и очков теперь есть общий API v0.1 (см. ниже). Полный облачный сейв пока отсутствует.

## Публикация

1. Разместите файлы в `public/games/<slug>/` и проверьте
   `/games/<slug>/game.html`.
2. Создайте запись в `/studio/games`; форма проверяет файл запросом HEAD.
3. Заполните SEO, обложку, описание, формат кадра и связи с контентом.
4. Опубликуйте игру. Публичный URL для ссылок и sitemap —
   **`https://canfly.org/games/<slug>`**, а не адрес HTML.
5. Проверьте, что публичная страница отдаёт корректные `title`,
   `description`, canonical, OG и robots; сама игра открывается в iframe.

## iframe и безопасность

`components/game-embed.tsx` открывает `game.html` в iframe.
`next.config.mjs` разрешает только этому файлу встраивание с того же
origin (`frame-ancestors 'self'`, `X-Frame-Options: SAMEORIGIN`)
и выставляет `X-Robots-Tag: noindex, nofollow`. Общая страница Next.js
остаётся невстраиваемой. Игры работают в одном origin с сайтом и могут
иметь доступ к его браузерному хранилищу, поэтому **не размещайте
непроверенный HTML/JS** и не считайте iframe с `allow-same-origin`
границей безопасности.

## Тестирование

Проверьте `e2e/games.spec.ts`: открытие публичной страницы, загрузку
`game.html`, ресурсы без 404, работу iframe и отсутствие индексации
самого файла. Изменения в игровом JS не должны ломать сохранения.


## Canfly Game API v0.1

Миграция: \`postgres/035_game_user_progress.sql\` — применить **до** деплоя API.
Общий клиент: \`/games/canfly-game-api.js\`. В \`game.html\` подключить:

\`\`\`html
<script src="/games/canfly-game-api.js"></script>
\`\`\`

SDK определяет \`slug\` из адреса \`/games/<slug>/game.html\`.
Токены в JS не нужны: используется текущая session cookie Canfly.

\`\`\`js
const progress = await CanflyGame.load();
console.log(progress.user, progress.lastScore, progress.bestScore, progress.history);

await CanflyGame.save('level_complete', {score: 250, details: {level: 2}});
await CanflyGame.save('checkpoint', {details: {scene: 'forest'}});
\`\`\`

- \`GET /api/games/<slug>/progress\`: текущий пользователь, последние/лучшие очки, последние 20 событий.
- \`POST /api/games/<slug>/progress\`: JSON с \`requestId\` (UUID),
  \`kind\` (латинские строчные буквы, цифры, подчёркивания, до 32 символов),
  необязательным \`score\` (целое от 0 до 1 млрд) и \`details\`
  (JSON-объект до 2 КБ). Ответ: \`{ok:true,saved:true|false}\`.
  Повтор одного requestId не создаёт вторую запись.
- Гость получает 401 \`login_required\`; игра обязана работать автономно.
- Лимит 120 записей/час на пользователя; Origin должен совпадать с сайтом.
- user_id определяется на сервере по сессии; сохранения разных игр разделены.
- Очки не проверяются игровым сервером: это личная статистика, не рейтинг с призами.
- Полные облачные сейвы пока не поддерживаются: локальное состояние игры
  остаётся в localStorage. Still Road отправляет событие \`save\` после
  локального сохранения; ошибки сети не блокируют игру.
