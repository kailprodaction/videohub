# Backend (VideoHub)

Go 1.22, HTTP API на chi. Один бинарь — `cmd/server`. Запускается, применяет миграции, при пустой БД делает seed, поднимает HTTP-сервер.

## Стек

- chi v5 (роутер) + go-chi/cors + go-chi/middleware (Logger, Recoverer, RequestID, Timeout)
- pgx/v5 + pgxpool (PostgreSQL)
- golang-jwt/v5 (HS256 JWT)
- golang.org/x/crypto/bcrypt (хэш паролей)
- google/uuid (генерация UUID)
- joho/godotenv (.env)

## Структура

```
backend/
├── cmd/server/main.go        точка входа: .env → pool → migrate → seed → router → ListenAndServe
├── migrations/*.sql          автонакат при старте (отсортированы по имени файла)
├── uploads/                  bind-mount с host: MP4/ для видео, PNG/ для картинок
└── internal/
    ├── config/               os.Getenv → Config (HTTPAddr, DatabaseURL, JWTSecret, ...)
    ├── db/                   Open(pool), Migrate(dir), DropAll
    ├── models/               DTO: User, Channel, Video, Comment, Subscription,
    │                         StatsPoint, ChannelStats, PlatformStats
    ├── auth/
    │   ├── jwt.go            Issue / Parse (HS256, claims uid+role)
    │   ├── middleware.go     Middleware (парс Bearer → context),
    │   │                     RequireAuth, RequireAdmin, UserID(r), Role(r)
    │   └── codes.go          GenerateCode (6 цифр через crypto/rand)
    ├── store/                репозитории (Pool *pgxpool.Pool)
    │   ├── store.go          New, ErrNotFound, isNoRows
    │   ├── users.go          List, Get, UpdateProfile, SetBlocked
    │   ├── channels.go       List, GetByID, GetByOwner, UpdateProfile,
    │   │                     AdminAdjustStats (вьюс/лайки/дизы/подписки → channel_overrides),
    │   │                     GetOverride
    │   ├── videos.go         ListVideos, GetVideo, CreateVideo, DeleteVideo,
    │   │                     AdminAdjustVideoStats (точечно по видео + admin_stat_events),
    │   │                     RegisterView (уникальный: EXISTS check, anonymous → no-op)
    │   ├── reactions.go      SetReaction (toggle like/dislike, обновляет счётчики и пишет reaction_events)
    │   ├── comments.go       List(byVideo), ListAll, Add, Delete
    │   ├── subscriptions.go  List, IsSubscribed, Subscribe, Unsubscribe
    │   │                     (атомарно: INSERT/DELETE + counter + sub_event)
    │   ├── stats.go          ChannelStats (14 дней: views/likes/dislikes из event-таблиц,
    │   │                     subscribers через sub_events delta, override-дельты по дням),
    │   │                     PlatformStats (тоталы + DAU)
    │   └── auth.go           CreateAuthCode, ConsumeAuthCode (atomic UPDATE WHERE expired),
    │                         GetUserByEmail/Username, IsLoginTaken,
    │                         CreateUserWithChannel (login+name+email+hash → user+канал в TX)
    ├── handlers/             HTTP обработчики (тонкие, делегируют в store)
    │   ├── handlers.go       Handlers struct, writeJSON/Error, readJSON, handleStoreErr,
    │   │                     currentUserID (JWT → query.userId → DEFAULT_USER_ID)
    │   ├── videos.go         + normalizeTags helper
    │   ├── channels.go, comments.go, subscriptions.go, users.go, stats.go
    │   ├── admin.go          AdminAdjustStats (канал), AdminAdjustVideoStats,
    │   │                     AdminBlockUser, AdminListComments
    │   ├── auth.go           Register / RegisterVerify / Login (login+password)
    │   │                     / AuthMe / respondWithToken / validEmail / loginRegexp
    │   └── uploads.go        UploadVideo/UploadImage (multipart, проверка ext+size,
    │                         сохранение в uploads/MP4 или /PNG с UUID-именем)
    ├── recommend/recommend.go  Rank(videos, hintCategory, limit)
    │                           формула: views*1 + likes*5 - dislikes*3 + freshnessBonus
    │                           бонус: (14 - daysOld) * 50, если daysOld < 14
    │                           совпадение категории = score * 1.4
    ├── seed/seed.go           10 users (admin/admin1 + 9 user/password),
    │                          10 channels, 3 subscriptions. Видео НЕ создаются.
    │                          Запускается если COUNT(users)=0. Аватары пустые.
    └── server/router.go       сборка chi роутов + global authpkg.Middleware,
                               /health, /uploads/* (FileServer), три группы /api:
                               публичные | RequireAuth | RequireAdmin
```

## Маршруты API

Публичные:
- `POST /api/auth/register`, `/register/verify`, `/login`, `GET /auth/me`
- `GET /api/videos[/{id}|/recommended|/{id}/recommendations|/{id}/comments]`
- `POST /api/videos/{id}/views` (анонимы получают `counted:false`, JWT — `true` один раз)
- `GET /api/channels[/{id}|/by-owner/{userId}|/{id}/stats]`
- `GET /api/users[/{id}]`

RequireAuth:
- `POST /api/videos` (создать), `DELETE /api/videos/{id}`
- `GET/POST /api/videos/{id}/reaction`
- `POST /api/videos/{id}/comments`, `DELETE /api/comments/{id}`
- `PATCH /api/channels/{id}`
- `GET /api/channels/{id}/subscribed`, `POST/DELETE /api/channels/{id}/subscribe`
- `GET /api/subscriptions`, `GET/PATCH /api/users/me`
- `POST /api/upload/video`, `POST /api/upload/image`

RequireAdmin:
- `GET /api/admin/stats`, `GET /api/admin/comments`
- `POST /api/admin/users/{id}/block`
- `POST /api/admin/channels/{id}/stats` (накрутка канала + видео-счётчики через override)
- `POST /api/admin/videos/{id}/stats` (точечная накрутка видео)

## Авторизация

- JWT HS256, claims: `uid`, `role`, `iss=videohub`, `sub=userID`, `iat`, `exp`.
- TTL — `JWT_TTL_HOURS` (по умолчанию 168 = 7 дней).
- `auth.Middleware` парсит `Authorization: Bearer <token>` → кладёт `userID` и `role` в context. Не отвергает гостей — это делает `RequireAuth`.
- `auth.UserID(r)` / `auth.Role(r)` — извлечь из context.
- `handlers.currentUserID(r)` имеет fallback: JWT → `?userId=` → `DEFAULT_USER_ID`. **Не использовать для счётчиков** — для уникальных просмотров берётся строго `authpkg.UserID(r)`.

## Регистрация по email + коду

1. `POST /auth/register { email, login, displayName, password }`
   - bcrypt(password), генерируем 6-значный код, пишем в `auth_codes` (вместе с хэшем).
   - В демо (`AUTH_EXPOSE_CODE=true`) возвращаем `devCode` в ответе.
2. `POST /auth/register/verify { email, code }` → `ConsumeAuthCode` (UPDATE used=TRUE WHERE expires_at>NOW()) → `CreateUserWithChannel` → JWT.

## Файлы (uploads)

- Папка: `UPLOADS_DIR` (в Docker — `/app/uploads`, bind-mount на host `./backend/uploads`).
- Видео (mp4/webm) → `uploads/MP4/<uuid>.<ext>`. Лимит `MAX_VIDEO_BYTES` (500 MB).
- Картинки (png/jpg/jpeg/webp) → `uploads/PNG/<uuid>.<ext>`. Лимит `MAX_IMAGE_BYTES` (10 MB).
- Раздаются через `/uploads/MP4/...`, `/uploads/PNG/...` стандартным `http.FileServer` (поддержка Range — перемотка работает).
- В JSON-ответе возвращается полный URL (`PUBLIC_BASE_URL + /uploads/...`).

## Счётчики и event-таблицы

- **Просмотры:** `video_views(video_id, user_id?)`. `RegisterView` уникальный по `(video_id, user_id)`. Денорм `videos.views_count`.
- **Реакции:** `video_reactions(user_id, video_id, reaction L|D)` PK по паре. История изменений — `reaction_events(prev, new)`. Денорм `videos.{likes,dislikes}_count`.
- **Подписки:** `subscriptions(subscriber, channel)` UNIQUE. Журнал — `subscription_events(action: subscribe|unsubscribe)`. Денорм `channels.subscribers_count`.
- **Админ-оверрайды:** `channel_overrides(channel_id, views, likes, dislikes, subscribers)` — накопительные дельты, применяются на лету в SQL (`v.views_count + COALESCE(o.views, 0)`).
- **Журнал админа:** `admin_stat_events(channel_id, video_id?, kind, delta)`.

## ENV

Описано в `.env.example`. Ключевые: `DATABASE_URL`, `JWT_SECRET`, `AUTH_EXPOSE_CODE`, `CORS_ORIGINS`, `RESEED_ON_START`.

## Запуск

- Локально: `cp .env.example .env && go run ./cmd/server`
- Docker: `docker compose up -d --build` из корня (см. корневой README).
