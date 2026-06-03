# Frontend (VideoHub)

React 18 + TypeScript + Vite. Single-page приложение, проксируется через nginx на backend (`/api` и `/uploads`).

## Стек

- React 18, TypeScript, Vite
- TailwindCSS — стили через CSS-переменные темы (`globals.css`), класс `dark` на `<html>`
- Zustand (с `persist` в localStorage) — клиентское состояние
- TanStack Query v5 — серверные запросы и кеш
- react-router-dom v6 — маршрутизация (`createBrowserRouter`)
- react-player — обёртка `<video>`, контролы пишем сами
- chart.js + react-chartjs-2 — графики статистики
- react-hook-form + zod — формы и валидация
- lucide-react — иконки
- clsx + tailwind-merge через `shared/lib/cn.ts`

## Структура

```
src/
├── app/                  bootstrap (main.tsx, router.tsx)
├── pages/                компоненты-страницы (тонкие, делегируют в features)
│   ├── auth/             LoginPage, RegisterPage, AuthLayout
│   ├── me/               MeDashboard, UploadPage, MyVideosPage, MyStatsPage
│   └── admin/            AdminLayout + 5 страниц (stats, users, channels, videos, comments)
├── features/             доменная логика
│   ├── auth/             RequireAuth (guard), AuthPrompt (модалка для гостей)
│   ├── video/            VideoCard, player/* (VideoPlayer и подкомпоненты)
│   ├── channel/          SubscribeButton
│   ├── comment/          CommentForm, CommentList
│   ├── theme/            ThemeBootstrap, ThemeToggle
│   ├── stats/            StatsChart (обёртка над Chart.js)
│   └── admin/            AdminStatsForm (форма накрутки канала)
├── shared/
│   ├── ui/               Button, Input, Avatar, states (Loader/ErrorState/EmptyState/Skeleton)
│   ├── layout/           Navbar, Sidebar, RootLayout
│   ├── hooks/            (пусто пока)
│   ├── lib/              cn.ts, format.ts (formatDuration/Number/timeAgo)
│   └── types/            User, Channel, Video, Comment, Subscription, Stats — все DTO
├── api/                  HTTP-клиент. Все вызовы идут через api/client.ts → fetch
│   ├── client.ts         api<T>() helper: добавляет Authorization из authStore,
│   │                     на 401 чистит токен. Базовый URL из VITE_API_BASE_URL.
│   ├── auth.ts           registerStart/Verify, login, fetchMe, logout
│   ├── videos.ts         fetchVideos, getById, recommendations, uploadVideo,
│   │                     uploadVideoFile/uploadImageFile (multipart),
│   │                     incrementViews, setReaction, adminAdjustVideoStats
│   ├── channels.ts       fetchChannels, getById, getChannelByOwner,
│   │                     updateChannelProfile, adminAdjustChannelStats
│   ├── comments.ts       fetch/add/delete + fetchAllComments (admin)
│   ├── subscriptions.ts  fetchSubscriptions, isSubscribed, subscribe/unsubscribe
│   ├── users.ts          fetchUsers, getById, getCurrentUser (null если 401),
│   │                     updateProfile, blockUser
│   └── stats.ts          getChannelStats, getPlatformStats
├── stores/
│   ├── authStore.ts      { token, user, setSession, clear } + useIsAuthenticated/useIsAdmin
│   ├── themeStore.ts     light/dark, persist
│   └── playerStore.ts    volume/muted/playbackRate/quality, persist v2 с migrate
└── styles/globals.css    CSS-переменные темы, скроллбары, плеер (.video-wrap fullscreen)
```

## Маршруты (см. app/router.tsx)

Публичные (без layout):
- `/login`, `/register` — формы авторизации
  - регистрация двухшаговая: email+login+name+password → код → verify
  - вход одношаговый: login+password

Под RootLayout (navbar + sidebar):
- `/` — HomePage, лента рекомендаций + чипы категорий
- `/watch/:videoId` — WatchPage с VideoPlayer
- `/channel/:channelId` — ChannelPage
- `/search?q=` — SearchPage

Под RequireAuth:
- `/subscriptions`, `/me`, `/me/upload`, `/me/videos`, `/me/stats`

Под RequireAuth admin:
- `/admin` → AdminLayout с вкладками: index, users, channels, videos, comments

`*` → NotFoundPage.

## Авторизация

- JWT хранится в localStorage через `authStore` (key `vh:auth`).
- `api/client.ts` автоматически добавляет `Authorization: Bearer <token>` и при 401 чистит стор (это разлогинивает пользователя).
- Гварды: `<RequireAuth>` редиректит на `/login`, `<RequireAuth admin>` — на `/` если роль не admin.
- Для UI-обёрток над защищёнными действиями есть `requireAuth(message)` в `features/auth/AuthPrompt.tsx`:
  - проверяет `authStore.getState()` синхронно;
  - если гость — открывает модалку и возвращает `false`;
  - используется в `SubscribeButton`, `WatchPage` (лайк/дизлайк), `CommentForm`.

## Видеоплеер (features/video/player/VideoPlayer.tsx)

- Один файл, ~250 строк. Использует `ReactPlayer` с `controls=false`.
- Своё: play overlay, прогресс-бар с drag (через window listeners), громкость, mute, скорость 0.25–3x ползунком, выбор качества, fullscreen через Fullscreen API.
- CSS-фикс в `globals.css`: `.video-wrap > div:first-child { position: absolute; inset: 0; }` — иначе react-player не растягивается.
- Звук управляется через `volume` (не `muted` prop): иначе залипает.
- При первом Play гарантированно снимаем mute и поднимаем громкость (user gesture).

## Темы

`themeStore` хранит `'light' | 'dark'`. `ThemeBootstrap` ставит/снимает класс `dark` на `<html>`. Цвета — CSS-переменные `--color-bg`, `--color-surface`, `--color-elevated`, `--color-border`, `--color-text`, `--color-muted`, `--color-brand`, `--color-danger`. Tailwind использует их через `rgb(var(--color-bg) / <alpha-value>)`.

## Загрузка файлов

В `UploadPage`:
1. `uploadVideoFile(file)` → `POST /api/upload/video` (multipart) → URL
2. `uploadImageFile(file)` → `POST /api/upload/image` (multipart) → URL
3. `uploadVideo({ channelId, title, description, thumbnailUrl, videoFileUrl, ... })` → `POST /api/videos`

Шаги делаются в `Promise.all` (файлы параллельно), затем создаётся запись видео.

## Адаптеры

В `api/videos.ts` backend отдаёт одно поле `videoUrl`. Адаптер `adapt()` оборачивает его в массив `sources: [{ quality: '720p', url }]`. Плеер видит один источник → меню качества показывает «Авто» (см. `multiQuality` flag).

## Конвенции

- Названия файлов: `PascalCase.tsx` для компонентов, `camelCase.ts` для модулей.
- Импорты с алиасом `@/` (настроено в `vite.config.ts` и `tsconfig.json`).
- На русском пишем UI-тексты, комментарии — на русском (язык пользователя).
- Все формы валидируются через Zod + RHF.
- Серверные данные — только в TanStack Query, **не** в Zustand.
- При мутации инвалидируем релевантные ключи: `qc.invalidateQueries({ queryKey: [...] })`.

## Vite

- `base` зависит от `VITE_BASE_PATH` (для деплоя в подпуть).
- `VITE_API_BASE_URL` — если пусто, ходим на тот же origin (через nginx-прокси). В dev задаём `http://localhost:8080`.
