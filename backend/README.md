# VideoHub Backend (Go + PostgreSQL)

Backend для дипломного проекта «видеохостинг». Полностью совместим
с frontend из соседней папки `../` (Vite + React).

* Авторизация **не требуется** — действия выполняются от имени тестового пользователя
  (его UUID — в `.env`, поле `DEFAULT_USER_ID`).
* PostgreSQL — единственная зависимость инфраструктуры; миграции применяются автоматически
  при старте, демо-данные вставляются, если в таблице `users` пусто.

## Структура

```
backend/
├── cmd/server/main.go        # entrypoint
├── migrations/001_init.sql   # схема
├── internal/
│   ├── config/               # переменные окружения
│   ├── db/                   # подключение и миграции
│   ├── models/               # типы (User, Channel, Video, ...)
│   ├── store/                # SQL-репозитории
│   ├── handlers/             # HTTP-обработчики
│   ├── server/router.go      # маршруты chi
│   ├── recommend/            # ранжирование рекомендаций
│   └── seed/                 # демо-данные
├── uploads/
│   ├── MP4/                  # видео (.mp4, .webm)
│   └── PNG/                  # картинки (.png, .jpg, .jpeg, .webp)
├── .env.example
└── README.md
```

## Установка зависимостей

Требования: **Go 1.22+** и **PostgreSQL 14+**.

```bash
cd backend
go mod download
```

## Создание базы данных

1. Установите PostgreSQL (или запустите в Docker).
2. Создайте пользователя и базу. Через `psql` под суперпользователем:

```sql
CREATE USER videohub WITH PASSWORD 'videohub';
CREATE DATABASE videohub OWNER videohub;
GRANT ALL PRIVILEGES ON DATABASE videohub TO videohub;
```

3. Скопируйте `.env.example` в `.env`. При необходимости поправьте `DATABASE_URL`.

```bash
cp .env.example .env
```

## Подключение к PgAdmin

1. Откройте PgAdmin → Add new server.
2. Tab **General**: Name = `VideoHub`.
3. Tab **Connection**:
   - Host: `localhost`
   - Port: `5432`
   - Maintenance DB: `videohub`
   - Username: `videohub`
   - Password: `videohub`
4. После подключения раскройте `Databases → videohub → Schemas → public → Tables` — там будут
   все таблицы (`users`, `channels`, `videos`, `comments`, `subscriptions`,
   `video_views`, `video_reactions`, `reaction_events`, `subscription_events`,
   `channel_overrides`, `admin_stat_events`).

## Запуск через Docker (рекомендуется)

В корне проекта лежит `docker-compose.yml` — поднимает весь стек одной командой:

```bash
docker compose up -d --build
```

Сервисы:

| Сервис    | URL                       | Описание                                   |
|-----------|---------------------------|--------------------------------------------|
| frontend  | http://localhost:8081     | nginx со статикой + прокси `/api` и `/uploads` на backend |
| backend   | http://localhost:8080     | Go-сервис                                  |
| postgres  | localhost:**5433**        | проброшен на 5433, чтобы не конфликтовать с локальным Postgres |
| pgadmin   | http://localhost:5050     | вход: `admin@videohub.com` / `admin`       |

Логи / остановка / полный сброс:

```bash
docker compose logs -f backend
docker compose down            # остановить
docker compose down -v         # остановить и удалить тома (БД и uploads)
```

## Запуск без Docker

```bash
go run ./cmd/server
```

При старте:
1. Применяются миграции из `./migrations`.
2. Если таблица `users` пустая — вставляются демо-данные
   (6 пользователей, 6 каналов, 12 видео, комментарии, подписки, 14 дней просмотров
   и реакций для графиков статистики).
3. Сервер слушает `:8080` (`HTTP_ADDR`).

Чтобы полностью пересоздать базу при старте:

```bash
RESEED_ON_START=true go run ./cmd/server
```

Сборка бинаря:

```bash
go build -o videohub-server ./cmd/server
./videohub-server
```

## Файлы

* Видео сохраняются в `uploads/MP4/<uuid>.mp4` (или `.webm`),
  ограничение — `MAX_VIDEO_BYTES` (500 MB по умолчанию).
* Картинки (превью, аватары, баннеры) — в `uploads/PNG/<uuid>.<ext>`,
  ограничение — `MAX_IMAGE_BYTES` (10 MB по умолчанию).
* Скачивание/стриминг идёт по `GET http://localhost:8080/uploads/MP4/<file>`
  и `GET http://localhost:8080/uploads/PNG/<file>` — отдаёт стандартный
  `http.FileServer`, который поддерживает Range-запросы (видео можно перематывать).

## REST API

Все ответы — JSON. Идентификатор «текущего» пользователя берётся
из `?userId=<uuid>`, иначе подставляется `DEFAULT_USER_ID`.

### Видео

| Метод   | Путь                                  | Описание                                            |
|---------|---------------------------------------|-----------------------------------------------------|
| GET     | `/api/videos`                         | Список (`?q=`, `?channelId=`, `?category=`, `?limit=`, `?onlyPublic=true`) |
| GET     | `/api/videos/{id}`                    | Одно видео                                          |
| POST    | `/api/videos`                         | Создать видео (после `/upload/...`)                 |
| DELETE  | `/api/videos/{id}`                    | Удалить                                             |
| POST    | `/api/videos/{id}/views`              | Увеличить счётчик просмотров                        |
| GET     | `/api/videos/{id}/reaction`           | Текущая реакция пользователя                        |
| POST    | `/api/videos/{id}/reaction`           | Поставить/снять реакцию `{ "reaction": "like" }`    |
| GET     | `/api/videos/recommended`             | Рекомендации для главной                            |
| GET     | `/api/videos/{id}/recommendations`    | Рекомендации рядом с плеером (по категории)         |
| GET     | `/api/videos/{id}/comments`           | Комментарии видео                                   |
| POST    | `/api/videos/{id}/comments`           | Добавить комментарий `{ "text": "..." }`            |

### Каналы

| Метод | Путь                                 | Описание                            |
|-------|--------------------------------------|-------------------------------------|
| GET   | `/api/channels`                      | Все каналы                          |
| GET   | `/api/channels/{id}`                 | Один канал                          |
| PATCH | `/api/channels/{id}`                 | Изменить имя/описание/аватар        |
| GET   | `/api/channels/by-owner/{userId}`    | Канал по владельцу                  |
| GET   | `/api/channels/{id}/stats`           | Статистика канала за 14 дней        |
| GET   | `/api/channels/{id}/subscribed`      | Подписан ли текущий пользователь    |
| POST  | `/api/channels/{id}/subscribe`       | Подписаться                         |
| DELETE| `/api/channels/{id}/subscribe`      | Отписаться                          |

### Подписки и пользователи

| Метод | Путь                       | Описание                            |
|-------|----------------------------|-------------------------------------|
| GET   | `/api/subscriptions`       | Список подписок текущего            |
| GET   | `/api/users`               | Все пользователи                    |
| GET   | `/api/users/me`            | Профиль текущего                    |
| PATCH | `/api/users/me`            | Изменить displayName / bio / avatar |
| GET   | `/api/users/{id}`          | Профиль по id                       |

### Загрузка файлов

| Метод | Путь                  | Описание                                                       |
|-------|-----------------------|----------------------------------------------------------------|
| POST  | `/api/upload/video`   | multipart, поле `file` (mp4/webm). Возвращает `{ "url": "..." }` |
| POST  | `/api/upload/image`   | multipart, поле `file` (png/jpg/jpeg/webp).                    |

### Комментарии и админ

| Метод   | Путь                                  | Описание                                                    |
|---------|---------------------------------------|-------------------------------------------------------------|
| DELETE  | `/api/comments/{id}`                  | Удалить комментарий (пользователь или админ)                |
| GET     | `/api/admin/comments`                 | Все комментарии (для админ-панели)                          |
| POST    | `/api/admin/users/{id}/block`         | Заблокировать/разблокировать `{ "blocked": true }`          |
| POST    | `/api/admin/channels/{id}/stats`      | Накрутка/уменьшение статистики канала                       |
| GET     | `/api/admin/stats`                    | Сводная статистика платформы                                |

#### Тело `POST /api/admin/channels/{id}/stats`

```json
{
  "viewsDelta": 1000,
  "likesDelta": 50,
  "dislikesDelta": -10,
  "subscribersDelta": 200
}
```

Дельты накапливаются в таблице `channel_overrides` и применяются при
любой выдаче (статистика канала, страница канала, страница видео,
графики, админ-панель).

## Логика счётчиков

* **Просмотры** — каждое обращение к `POST /api/videos/{id}/views` пишет строку в
  `video_views` (источник для графика по дням) и инкрементирует денормализованный
  `videos.views_count`.
* **Реакции** — `POST /api/videos/{id}/reaction`:
  * повторный лайк = снять;
  * лайк ⇄ дизлайк — корректно меняет оба счётчика;
  * каждое изменение пишется в `reaction_events`.
* **Подписки** — `POST/DELETE /api/channels/{id}/subscribe`: меняет
  `channels.subscribers_count`, пишет в `subscription_events`.
* **Админский override** — `channel_overrides` хранит накопительные дельты,
  которые добавляются ко всем счётчикам канала и его видео при выдаче
  и распределяются по дням на графиках статистики.

## Рекомендации

Реализованы в `internal/recommend`. Формула из ТЗ:

```
rating = views * 1 + likes * 5 - dislikes * 3 + freshnessBonus
```

`freshnessBonus` равен `(14 - daysOld) * 50` для свежих видео (не старше 14 дней),
иначе 0. Видео той же категории получает дополнительный множитель `1.4`.

* `GET /api/videos/recommended` отдаёт топ по чистой формуле.
* `GET /api/videos/{id}/recommendations` отдаёт топ из той же категории
  (исключая текущее видео), а если категории не хватило — добивает из общего пула.

## Проверка работы

После запуска:

```bash
curl http://localhost:8080/health                   # ok
curl http://localhost:8080/api/videos/recommended | head
curl http://localhost:8080/api/channels             | head
curl http://localhost:8080/api/admin/stats          | head
```

Открыть в браузере: `http://localhost:8080/uploads/PNG/<загруженный-файл>` — картинка
должна отрисоваться. Видео из `uploads/MP4/...` открывается тегом `<video src=...>`
и поддерживает перемотку (Range).

## Переменные окружения

| Переменная           | По умолчанию                                                | Описание                          |
|----------------------|-------------------------------------------------------------|-----------------------------------|
| `HTTP_ADDR`          | `:8080`                                                     | адрес HTTP                        |
| `DATABASE_URL`       | `postgres://videohub:videohub@localhost:5432/videohub?sslmode=disable` | строка подключения  |
| `UPLOADS_DIR`        | `./uploads`                                                 | папка статических файлов          |
| `PUBLIC_BASE_URL`    | `http://localhost:8080`                                     | базовый URL для ссылок на файлы   |
| `CORS_ORIGINS`       | `http://localhost:5173`                                     | список origin через запятую       |
| `MAX_VIDEO_BYTES`    | `524288000`                                                 | лимит размера видео (500 MB)      |
| `MAX_IMAGE_BYTES`    | `10485760`                                                  | лимит размера картинки (10 MB)    |
| `DEFAULT_USER_ID`    | `11111111-1111-1111-1111-111111111111`                      | UUID тестового пользователя       |
| `RESEED_ON_START`    | `false`                                                     | пересоздать схему при старте      |
