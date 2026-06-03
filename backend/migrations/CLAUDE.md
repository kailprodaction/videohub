# Database (PostgreSQL 16)

Схема описана в `.sql` файлах в этой папке. При старте backend применяет их по порядку имени файла (`db.Migrate`). Без таблицы версий — все файлы используют `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`, поэтому повторный запуск безопасен.

## Файлы миграций

| Файл                              | Что делает                                                          |
|-----------------------------------|---------------------------------------------------------------------|
| `001_init.sql`                    | базовые таблицы: users, channels, videos, comments, reactions, views, subscriptions, events, overrides |
| `002_auth.sql`                    | `users.password_hash` + таблица `auth_codes`                        |
| `003_auth_password.sql`           | `auth_codes.login` + `auth_codes.password_hash` (для регистрации)   |
| `004_admin_video_stats.sql`       | `admin_stat_events.video_id` + индекс                               |

Расширение: `pgcrypto` (для `gen_random_uuid()`).

## Таблицы

### users
- `id UUID PK DEFAULT gen_random_uuid()`
- `username TEXT UNIQUE` — используется как login для входа
- `display_name TEXT`, `email TEXT UNIQUE`, `avatar_url TEXT`, `bio TEXT`
- `role TEXT CHECK (role IN ('user','admin'))`
- `blocked BOOL`, `created_at TIMESTAMPTZ`
- `password_hash TEXT NULL` — bcrypt; NULL у seed-аккаунтов без пароля (сейчас у всех есть)

### channels
- `id UUID PK`, `owner_id UUID FK users(id) ON DELETE CASCADE`, **UNIQUE(owner_id)** — у юзера ровно один канал
- `name`, `handle UNIQUE` (`@xxx`), `description`, `avatar_url`, `banner_url`
- `subscribers_count BIGINT` — денормализованный счётчик

### videos
- `id UUID PK`, `channel_id FK ON DELETE CASCADE`
- `title`, `description`, `thumbnail_url`, `video_url`, `duration_sec INT`
- `views_count BIGINT`, `likes_count BIGINT`, `dislikes_count BIGINT` — денормализованные
- `category TEXT` (tech/music/gaming/education/entertainment/sports/news/other)
- `visibility TEXT CHECK ('public'|'private')`
- `tags TEXT[]`, `uploaded_at TIMESTAMPTZ`
- Индексы: `channel_id`, `uploaded_at DESC`, `category`

### comments
- `id UUID PK`, `video_id FK CASCADE`, `author_id FK CASCADE`
- `text TEXT`, `likes INT`, `created_at`
- Индекс: `(video_id, created_at DESC)`

### video_reactions  (PK: user_id, video_id)
- `reaction CHAR(1) CHECK ('L','D')` — одна реакция на пару пользователь/видео
- `updated_at`

### reaction_events
- `id BIGSERIAL PK`, `user_id`, `video_id`, `new_reaction`, `prev_reaction`, `created_at`
- new/prev принимают `'like'|'dislike'|'none'`
- Используется в `ChannelStats` для подсчёта лайков/дизов по дням
- Индекс: `(video_id, created_at)`

### video_views
- `id BIGSERIAL PK`, `video_id`, `user_id NULL`, `created_at`
- Backend пишет одну строку на пару `(user_id, video_id)` — повторно не вставляется
- Анонимные просмотры (user_id IS NULL) в текущей логике не пишутся
- Индексы: `(video_id, created_at)`, `(created_at)`

### subscriptions  (UNIQUE: subscriber_id, channel_id)
- `id UUID PK`, `subscriber_id FK`, `channel_id FK`, `created_at`

### subscription_events
- `id BIGSERIAL PK`, `subscriber_id`, `channel_id`
- `action TEXT CHECK ('subscribe'|'unsubscribe')`, `created_at`
- Источник для графика прироста подписчиков по дням
- Индекс: `(channel_id, created_at)`

### channel_overrides  (PK: channel_id)
- `views BIGINT`, `likes BIGINT`, `dislikes BIGINT`, `subscribers BIGINT` — накопительные дельты
- `updated_at`
- Применяются на лету в `videoSelect` и `channelSelect` через `+ COALESCE(o.X, 0)`
- Касаются и видео, и канала, и статистики (распределяются равномерно по дням)

### admin_stat_events
- `id BIGSERIAL PK`, `channel_id`, `video_id NULL` (с миграции 004)
- `kind TEXT CHECK ('views'|'likes'|'dislikes'|'subscribers')`
- `delta BIGINT`, `created_at`
- Журнал админских правок (для аудита). `video_id IS NULL` — операция на уровне канала.

### auth_codes
- `id UUID PK`, `email TEXT`, `code TEXT`, `kind TEXT CHECK ('register'|'login')`
- `display_name TEXT`, `login TEXT`, `password_hash TEXT` (заполняется при register)
- `used BOOL`, `expires_at`, `created_at`
- При новом коде того же типа старые помечаются `used=TRUE`
- `ConsumeAuthCode` атомарно ставит `used=TRUE` через `UPDATE WHERE id=(SELECT ...)`
- Индекс: `(email, kind, used)`

## Каскады удаления

Удаление пользователя → удаляются канал, видео, комментарии, реакции, просмотры, подписки (CASCADE). Удаление канала → удаляются видео, подписки, оверрайды, события. Удаление видео → удаляются комментарии, реакции, просмотры, video_id-ссылки в event-таблицах.

## Денормализация

Реальные счётчики живут в `videos.{views,likes,dislikes}_count` и `channels.subscribers_count`. Они инкрементируются в той же транзакции что и INSERT в event-таблицу — гарантирует целостность. На выдаче складываются с `channel_overrides.*` через SQL JOIN.

## Соглашения по миграциям

- Имя файла: `NNN_kebab-case.sql`, NNN строго возрастает (применяются по алфавиту).
- Каждая команда — `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`. Никогда `DROP` в продакшене без явной необходимости.
- Применяются как единый батч на файл — обернуть в `BEGIN; ... COMMIT;` не нужно, pgx обрабатывает многострочный SQL.
- Полный сброс схемы: `RESEED_ON_START=true` → `db.DropAll()` (`DROP SCHEMA public CASCADE`).

## Подключение через PgAdmin (docker compose)

- Host: `postgres` (внутри сети) или `localhost:5433` (с хоста)
- DB: `videohub`, User/Password: `videohub` / `videohub`
- В compose `pgadmin` авторегистрирует сервер через `pgadmin/servers.json`

## Полезные запросы

```sql
-- Просмотры по дням за неделю
SELECT date_trunc('day', created_at)::date, COUNT(*)
FROM video_views WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY 1 ORDER BY 1;

-- Топ видео по рейтингу (та же формула, что в recommend.go)
SELECT id, title,
       views_count + likes_count*5 - dislikes_count*3 AS score
FROM videos WHERE visibility = 'public' ORDER BY score DESC LIMIT 20;

-- Активные авторы комментариев
SELECT author_id, COUNT(*) AS n FROM comments
GROUP BY 1 ORDER BY n DESC LIMIT 10;
```
