# Игры

Проверено по [коммиту](README.md). **Факт:** [`/games`](../../app/games/page.tsx) показывает каталог, [`/games/[slug]`](../../app/games/[slug]/page.tsx) загружает опубликованную игру и связи, [`GameEmbed`](../../components/game-embed.tsx) встраивает статический контент из [`public/games/`](../../public/games/). Запросы и связи — в [`lib/server/games.ts`](../../lib/server/games.ts); таблицы `games`, `release_games`, `character_games`. Редактирование — [`app/studio/games/`](../../app/studio/games/) и [`lib/actions/studio-games.ts`](../../lib/actions/studio-games.ts).

**Факт:** правила заголовков в [`next.config.mjs`](../../next.config.mjs) допускают встраивание файла игры с того же origin; страница-обёртка остаётся отдельно. В рассмотренном пути не обнаружена запись игрового прогресса или события запуска в PostgreSQL. Это отсутствие относится к проверенному коду, не к возможной аналитике внутри самих файлов игры.
