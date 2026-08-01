# STUDIO.WIP

## Шаг 1: Миграция + типы — DONE
- Создан `postgres/003_add_audiorelease.sql` — добавляет значение `audiorelease` в enum `edition_format`
- Обновлен `lib/releases-types.ts:3` — `EditionFormat` теперь включает `'audiorelease'`

## Шаг 2: EditionFormatSelector + маршрут — DONE
- Создан `components/studio/edition-format-selector.tsx` — полноэкранный селектор форматов с карточками (Книга, Комикс, Аудиокнига, Аудиорелиз, Журнал)
- Создан `app/studio/editions/new/page.tsx` — Server Component, принимает `releaseId` из searchParams, рендерит EditionFormatSelector

## Шаг 3: Actions + Setup route + Setup page — DONE
- Добавлены `getEditionSetupData` и `updateEditionSetupAction` в `lib/actions/studio.ts` — загрузка данных для setup (edition, release, characters, series, links) и сохранение настроек (slug, platform, cover, annotation, персонажи, серия)
- Изменен редирект после `createEditionAction` с `/studio/editions/[id]` на `/studio/editions/[id]/setup`
- Создан `app/studio/editions/[id]/setup/page.tsx` — Server Component, загружает setup data, рендерит EditionSetupPage
- Создан `components/studio/edition-setup-page.tsx` — клиентский компонент с полями: slug, platform, external_url, cover_image, annotation, выбор персонажей с ролями (main/supporting/cameo), привязка к серии с phase_number, условные блоки для comic (ComicPagesEditor) и audio (AudioTracksEditor)

## Шаг 4: ComicPagesEditor + AudioTracksEditor — DONE
- Создан `components/studio/comic-pages-editor.tsx` — редактор страниц комикса: upload через /api/studio/upload, add by URL, drag reorder, delete, preview grid
- Создан `components/studio/audio-tracks-editor.tsx` — редактор аудио-треков: add (title + url + duration), inline edit, reorder, delete

## Шаг 5: Обновление существующих компонентов — DONE
- `components/studio/release-page-client.tsx` — заменен `EditionFormDialog` на Link-кнопку → `/studio/editions/new?releaseId=X`
- `components/studio/edition-page-client.tsx` — добавлены Tabs (Главы / Настройки), динамические названия глав/треков/статьй по формату, кнопка «Настройки» → `/studio/editions/[id]/setup`
- `components/studio/edition-card.tsx` — добавлен `audiorelease: Radio / Аудиорелиз` в formatIcons и formatLabels

## Шаг 6: Проверка — DONE
- TypeScript: нет ошибок в новых/обновлённых файлах
- Build: успешно, все маршруты видны в output
- Предшествующие ошибки (admin/upload, users) — не наши

## Шаг 7: Миграция design_config + типы — DONE
- Создан `postgres/004_release_design.sql` — добавляет колонку `design_config` (JSONB) в таблицу `releases`
- Обновлен `lib/releases-types.ts` — добавлены `ReleaseDesignConfig`, `HeroStyle`, `HeroOverlay`, `ReleaseLayout`; `Release` теперь включает `design_config`
- Обновлен `lib/server/releases.ts` — `releaseColumns` включает `design_config`; добавлена функция `updateReleaseDesign`
- Добавлен `updateReleaseDesignAction` в `lib/actions/studio.ts`

## Шаг 8: ReleaseDesignForm + таб «Дизайн» — DONE
- Создан `components/studio/release-design-form.tsx` — форма настроек дизайна: предустановки (canfly default, тёмный минимал, светлый, артхаус), color pickers (accent/bg/text), hero style/overlay, layout, show_toc/show_characters/show_series, live preview
- Обновлен `components/studio/release-page-client.tsx` — добавлен таб «Дизайн» с `Palette` icon
- Обновлен `components/studio/release-card.tsx` — «Перейти» → `/release/${release.slug}` (не `/books/`)

## Шаг 9: Публичные страницы релиза — DONE
- Создан `app/release/[slug]/page.tsx` — Server Component, загружает release + editions + characters + series, рендерит ReleasePagePublic
- Создан `components/release-page.tsx` — публичная страница релиза с design_config: hero (full/centered/minimal + overlay), цвета, layout, персонажи, серия, издания как cards
- Создан `app/release/[slug]/[editionSlug]/page.tsx` — издание, главы для чтения
- Создан `app/release/[slug]/[editionSlug]/[chapterIndex]/page.tsx` — конкретная глава
- Создан `components/release-reader.tsx` — ридер с design_config: sticky header, toc (sidebar), chapter navigation, inline HTML content

## Шаг 10: Build check — DONE
- TypeScript: нет ошибок в новых файлах
- Build: успешно, маршруты `/release/[slug]`, `/release/[slug]/[editionSlug]`, `/release/[slug]/[editionSlug]/[chapterIndex]` видны в output