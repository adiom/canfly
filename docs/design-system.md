# Canfly Design System

Правила для всех агентов и разработчиков при работе с UI canfly.

---

## 1. Цветовая палитра

Использовать **только** CSS-переменные `cf-*` через Tailwind-классы. Не хардкодить hex-значения — кроме случаев когда переменная недоступна (напр. opacity-трюки через inline style).

| Tailwind-класс | Светлая тема | Тёмная тема | Назначение |
|---|---|---|---|
| `bg-cf-bg` | `#f4efe5` | `#111210` | Фон страниц |
| `bg-cf-bg-2` | `#ebe5d9` | `#1b1c19` | Фон карточек, панелей |
| `bg-cf-footer-bg` | `#e0dace` | `#0c0d0c` | Фон футера |
| `text-cf-text-1` | `#1a1816` | `#f4efe5` | Основной текст |
| `text-cf-text-2` | `#3d3830` | `#ded7cc` | Вторичный текст, nav |
| `text-cf-text-3` | `#6b6058` | `#9f978b` | Muted / placeholder |
| `text-cf-text-4` | `#8a7e74` | `#8f877c` | Disabled, footer |
| `text-cf-text-heading` | `#0e0d0c` | `#fff8ea` | Заголовки |
| `text-cf-text-caption` | `#4a4440` | `#c9c1b4` | Подписи, body copy |
| `text-cf-accent` / `bg-cf-accent` | `#d52525` | `#d52525` | Красный акцент (оба режима) |
| `text-cf-warm` / `bg-cf-warm` | `#a07428` | `#f6d6a8` | Тёплый / золотой акцент |
| `text-cf-blue` | `#3d6e8c` | `#9db5c8` | Синий акцент |
| `text-cf-tan` | `#7a6450` | `#d7c6ad` | Бежевый акцент |

**Правила:**
- `dark:` Tailwind-префикс **не используется** в компонентах — смена темы работает через CSS-переменные (`.dark` класс на `<html>`)
- Opacity-варианты: `border-cf-text-1/10`, `bg-cf-text-1/6`, `bg-cf-accent/20`
- Переменные определены в `app/globals.css`, Tailwind-токены — в блоке `@theme inline`

### Палитра VVVVV (`/vvvvv`)

Лендинг литературной среды — единственное согласованное исключение из правила «только `cf-*`». VVVVV подан как самостоятельный бренд внутри экосистемы canfly, поэтому у него своя палитра в scoped-блоке `.vvvvv-scope` (`app/globals.css`). Правило «hex только в `globals.css`» при этом соблюдено — в компонентах хардкода нет.

| Переменная | Значение | Источник | Назначение |
|---|---|---|---|
| `--vv-void` | `#111210` | CF-004 `void` | Фон страницы |
| `--vv-page` | `#161714` | между CF-004 и CF-006 | Лист разворота |
| `--vv-ink` | `#f4efe5` | CF-003 `manuscript` | Основной текст |
| `--vv-ink-2` | `#cec8bb` | CF-003, приглушённый | Текст фрагмента |
| `--vv-ink-3` | `#8b8478` | CF-003, служебный | Метки, номера страниц |
| `--vv-ochre` | `#dcb463` | CF-016 `orpiment` | Единственный акцент |
| `--vv-rule` | `rgba(244, 239, 229, 0.1)` | CF-003 под 10% | Линии, корешок |

**Правила:**
- Применять через arbitrary-значения: `bg-[var(--vv-void)]`, `text-[var(--vv-ink)]`
- Блок `.vvvvv-scope` намеренно **не** зависит от `.dark` — страница остаётся в темноте void при любой выбранной посетителем теме
- Красный `cf-accent` на VVVVV не используется: акцент бренда — охра CF-016
- Класс `dark` на корневой обёртке `app/vvvvv/page.tsx` — это не запрещённый префикс `dark:`, а переключение `cf-*` в тёмные значения ради `SiteFooter`. Убирать нельзя: иначе футер ляжет светлой полосой на void
- Контраст на `--vv-void`: охра 9.7:1, `--vv-ink-3` 5.1:1 — обе выше AA
- Типографика VVVVV тоже своя: Cormorant Garamond (заголовки), EB Garamond (текст), Geist Mono (служебное). Приёмы из раздела 2 (`font-black uppercase`) там не применяются

---

## 2. Типографика

```
Eyebrow / label:   font-mono text-[9px] uppercase tracking-[0.2em] text-cf-accent
                   (или: text-xs font-black uppercase tracking-[0.18em] text-cf-accent)
Nav link:          text-xs font-black uppercase tracking-[0.12em] text-cf-text-2
H1 hero:           text-4xl font-black uppercase leading-[0.88] sm:text-5xl md:text-6xl lg:text-8xl text-cf-text-heading
H1 page:           text-4xl font-black uppercase leading-none text-cf-text-heading md:text-6xl
H2 section:        text-2xl font-black uppercase leading-none text-cf-text-heading sm:text-3xl md:text-5xl
H3 card:           text-xl font-black uppercase text-cf-text-heading
Body large:        text-base leading-7 text-cf-text-2 md:text-lg
Body:              leading-7 text-cf-text-caption
Caption:           text-sm text-cf-text-caption
Micro:             text-xs text-cf-text-3
```

---

## 3. Кнопки

```tsx
// Primary (red) — основное действие
<button className="h-12 px-5 bg-cf-accent text-white font-black uppercase text-sm tracking-[0.1em] hover:bg-[#b81e1e] transition-colors">
  Действие
</button>

// Primary (warm) — второстепенное основное
<button className="h-12 px-5 bg-cf-warm text-[#171713] font-black uppercase text-sm inline-flex items-center">
  Действие
</button>

// Secondary — нейтральное действие
<button className="h-12 px-5 border border-cf-text-1/18 text-cf-text-1 font-bold uppercase text-sm hover:bg-cf-text-1/8 transition-colors">
  Назад
</button>

// Ghost icon — иконки в хедере и т.п.
<button className="h-9 w-9 flex items-center justify-center rounded text-cf-text-2 hover:bg-cf-text-1/6">
  <Icon />
</button>

// Danger / subtle destructive
<button className="h-11 border border-cf-text-1/15 text-cf-text-3 hover:border-cf-text-1/30 hover:text-cf-text-1 transition-colors">
  Удалить
</button>

// Disabled state (добавить к любой кнопке)
className="... opacity-40 cursor-not-allowed"
```

---

## 4. Карточки и контейнеры

```
Card:              border border-cf-text-1/10 bg-cf-bg-2
Card hover:        hover:border-cf-warm/45 transition-colors
Card padded:       p-4 sm:p-6
Container:         mx-auto max-w-7xl px-4 md:px-8
Section:           py-12 md:py-16 border-b border-cf-text-1/10
Inner section:     py-16
```

---

## 5. Бордеры

```
Separator:         border-t border-cf-text-1/10  (или border-b)
Card default:      border border-cf-text-1/10
Card hover:        hover:border-cf-warm/45
Nav active:        border-x border-cf-text-1/10
Nav default:       border-x border-transparent
Input:             border border-cf-text-1/10 focus:border-cf-text-1/30
```

---

## 6. Состояния загрузки

```tsx
// Скелетон-блок
<div className="animate-pulse bg-cf-text-1/10 rounded h-6 w-48" />

// Inline загрузка
<p className="text-center py-12 text-cf-text-3">Загрузка...</p>

// Full-page загрузка (app/loading.tsx)
<main className="min-h-screen bg-cf-bg flex items-center justify-center">
  <p className="text-cf-text-3 text-sm">Загрузка...</p>
</main>
```

---

## 7. Состояния ошибок и пустых результатов

```tsx
// Пустой список
<div className="text-center py-12 text-cf-text-3">Ничего не найдено</div>

// Inline ошибка
<p className="text-cf-accent text-xs">{error}</p>

// Блок ошибки
<div className="border border-cf-accent/30 bg-cf-accent/10 rounded px-4 py-3 text-cf-accent text-sm">
  {error}
</div>

// Нет доступа
<p className="text-xs font-bold uppercase tracking-[0.18em] text-cf-accent">Нет доступа</p>
```

---

## 8. Header

Используй компонент `<SiteHeader activePath="/path" />` из `components/site-header.tsx`.

**Структура:**
```
sticky top-0 z-[60] border-b border-cf-text-1/10 bg-cf-bg/92 backdrop-blur-xl
  mx-auto max-w-7xl flex h-14 items-center justify-between px-4 md:px-8
    [Лого] [Nav desktop lg:flex] [ThemeToggle + MobileNav]
```

**Логотип:**
```tsx
<Link href="/">
  <span className="flex h-9 w-16 items-center justify-center bg-cf-accent text-lg font-black uppercase tracking-[-0.04em] text-white">
    canfly
  </span>
</Link>
```

**Nav item (active):**
```
border-x border-cf-text-1/10 bg-cf-text-1/6 text-cf-text-heading
```

**Nav item (default):**
```
border-x border-transparent text-cf-text-2 hover:border-cf-text-1/10 hover:bg-cf-text-1/6 hover:text-cf-text-heading
```

**Правила:**
- Desktop nav: `hidden lg:flex h-14 items-center`
- Mobile nav: `MobileNav` компонент, видим на `lg:hidden`
- z-index: `z-[60]` (выше диалогов `z-50`)
- `dark:` не используется — цвета адаптируются через CSS-переменные

---

## 9. Footer

Используй компонент `<SiteFooter variant="simple" />` из `components/site-footer.tsx`.

```
Simple (все страницы кроме главной):
  border-t border-cf-text-1/10 bg-cf-footer-bg mt-20 py-8 text-center
  text-sm text-cf-text-4

Full (главная страница):
  border-t border-cf-text-1/10 bg-cf-footer-bg px-4 py-8 md:px-8
  mx-auto max-w-7xl [колонки с ссылками]
```

**Copyright:** `© 2005-2026 canfly | культура твоего сознания.`

---

## 10. Навигация (NAV_ITEMS)

Единственный источник истины — `lib/nav.ts`. Не дублировать `navItems` в компонентах страниц.

```ts
// lib/nav.ts
export const NAV_ITEMS = [
  { label: 'Новости', href: '/news' },
  { label: 'Книги', href: '/books' },
  { label: 'Персонажи', href: '/characters' },
  { label: 'Цвета', href: '/colors' },
  { label: 'Магазин', href: '/shop' },
]
```

---

## 11. z-index стек

| z-index | Что |
|---|---|
| `z-40` | Backdrop / overlay |
| `z-50` | Диалоги, sheets, floating panels |
| `z-[60]` | Sticky header |
| `z-[100]` | Toast / критические уведомления |
| `z-[200]` | Full-screen модалки (напр. ColorModal) |

---

## 12. Error boundaries

**Обязательные файлы:**
- `app/not-found.tsx` — кастомный 404
- `app/error.tsx` — `'use client'`, с кнопкой `reset()`
- `app/global-error.tsx` — `'use client'`, с `<html>` + `<body>` (требование Next.js)
- `app/loading.tsx` — скелетон для root-уровня

**Все error-страницы должны:**
1. Использовать `bg-cf-bg text-cf-text-1` (адаптируется к теме)
2. Показывать логотип canfly (красный блок)
3. Иметь кнопку "На главную" (Secondary button)
4. Не использовать `slate-*`, `gray-*` или другие дефолтные Tailwind-цвета — только `cf-*`

---

## 13. Запрещено

- `dark:` Tailwind-префикс в компонентах
- Хардкоженые hex-цвета вне `app/globals.css`
- `slate-*`, `gray-*`, `zinc-*` и другие дефолтные Tailwind-цвета в UI
- Дублирование `navItems` — только через `lib/nav.ts`
- `console.log` в production-коде
- `any` в TypeScript

Единственное исключение по цветам — палитра VVVVV (раздел 1): свои токены `--vv-*` в scoped-блоке `.vvvvv-scope`. Все hex при этом остаются в `app/globals.css`, так что правило выше соблюдено.

---

## 14. Файловая структура UI

```
components/
  ui/             — shadcn/ui базовые компоненты
  site-header.tsx — общий header (использует NAV_ITEMS из lib/nav.ts)
  site-footer.tsx — общий footer (variant: 'full' | 'simple')
  theme-toggle.tsx
  mobile-nav.tsx
  search/         — SearchDialog и результаты
lib/
  nav.ts          — NAV_ITEMS (единственный источник)
app/
  globals.css     — CSS-переменные cf-* + @theme inline
  not-found.tsx   — кастомный 404
  error.tsx       — error boundary
  global-error.tsx
  loading.tsx
```
