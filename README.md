# VideoHub — дипломный проект

Простой видеохостинг типа YouTube: пользовательская часть (главная, просмотр,
каналы, подписки, личный кабинет) + админ-панель с накруткой статистики.

* **Frontend:** React 18 + TypeScript + Vite + TailwindCSS + Zustand + TanStack Query.
* **Backend:** Go 1.22 (chi, pgx, JWT, bcrypt).
* **БД:** PostgreSQL 16. Схема и сидинг применяются автоматически при старте.
* **Контейнеризация:** docker compose — единая команда для всего стека.

## Структура

```
.
├── src/                  # frontend (Vite)
├── backend/              # Go backend (cmd/server, internal/*, migrations/)
├── nginx.conf            # SPA + прокси /api /uploads на backend
├── Dockerfile            # frontend образ
├── docker-compose.yml    # postgres + backend + frontend + pgadmin
└── pgadmin/servers.json  # авторегистрация сервера в pgadmin
```

## Быстрый запуск (Docker)

Требуется **Docker Desktop** (или Docker Engine + Compose).

```bash
docker compose up -d --build
```

Поднимется четыре сервиса:

| Сервис    | URL                       | Описание                                            |
|-----------|---------------------------|-----------------------------------------------------|
| frontend  | http://localhost:8081     | SPA, прокси `/api` и `/uploads` на backend          |
| backend   | http://localhost:8080     | Go API (миграции + сидинг применяются автоматически)|
| postgres  | localhost:**5433**        | Внутри сети `postgres:5432`                         |
| pgadmin   | http://localhost:5050     | Вход: `admin@videohub.com` / `admin`                |

Остановить с сохранением всех данных:

```bash
docker compose down       # видео, аватарки, БД и всё прочее переживёт перезапуск
```

Полный сброс (стереть БД и pgadmin; **uploads сохранятся** — они bind-mount'ом
лежат в `./backend/uploads/MP4` и `./backend/uploads/PNG`):

```bash
docker compose down -v
```

### Где хранятся данные

| Что               | Где                                  | Переживёт `down -v` |
|-------------------|--------------------------------------|---------------------|
| Загруженные видео | `./backend/uploads/MP4/` (на хосте)  | Да (bind-mount)     |
| Превью / аватарки | `./backend/uploads/PNG/` (на хосте)  | Да (bind-mount)     |
| База PostgreSQL   | named volume `postgres_data`         | Нет                 |
| Настройки pgadmin | named volume `pgadmin_data`          | Нет                 |

Файлы пользователей не пропадают при штатных перезапусках. Если делаешь
`down -v`, файлы остаются на диске, но ссылки на них в БД исчезают вместе со
схемой — после нового `up` сидинг создаст пустую таблицу `videos`, а лежащие
на диске mp4/png не подтянутся обратно. Чтобы избежать этого, не используй
флаг `-v` при штатной остановке.

## Демо-аккаунты

При первом запуске seed создаёт 10 пользователей. Для входа на http://localhost:8081/login:

| Логин          | Пароль     | Роль          |
|----------------|------------|---------------|
| `admin`        | `admin1`   | администратор |
| `tech_guru`    | `password` | пользователь  |
| `music_master` | `password` | пользователь  |
| `gamer_pro`    | `password` | пользователь  |
| `edu_channel`  | `password` | пользователь  |
| `sport_zone`   | `password` | пользователь  |
| `ivan`         | `password` | пользователь  |
| `cooking`      | `password` | пользователь  |
| `travel`       | `password` | пользователь  |
| `art_studio`   | `password` | пользователь  |

Видео в seed нет — лента изначально пустая. Залогинься, открой **Загрузить** и
залей mp4/webm + превью. После этого видео появится в ленте, на канале и
в `/admin/videos`.

## Запуск без Docker (для разработки)

**Postgres** должен быть доступен по `DATABASE_URL` из `.env`.

```bash
# Backend
cd backend
cp .env.example .env       # при необходимости поправь креды
go mod download
go run ./cmd/server

# Frontend (в другом терминале)
npm install
npm run dev                # http://localhost:5173
```

В дев-режиме фронт ходит на тот же origin — задай `VITE_API_BASE_URL=http://localhost:8080`,
если backend на другом порту.

## Основные возможности

### Пользователь
- Главная страница с рекомендациями (формула `views + likes*5 - dislikes*3 + freshnessBonus`).
- Просмотр видео: кастомный плеер на react-player с собственными контролами
  (play/pause, прогресс-бар с drag, громкость, скорость 0.25–3×, fullscreen).
- Лайки / дизлайки, комментарии, подписки на каналы.
- Личный кабинет: редактирование профиля и канала, загрузка видео (mp4/webm) и
  превью (png/jpg/webp), статистика своего канала на графиках.
- Поиск по названию/описанию/тегам.

### Админ
- Просмотр пользователей, каналов, видео, комментариев, общей статистики.
- Блокировка/разблокировка пользователей.
- Удаление видео и комментариев.
- **Накрутка статистики**:
  - на канале — подписчики, общие просмотры/лайки/дизлайки;
  - на отдельном видео — просмотры, лайки, дизлайки.

### API
Полный список эндпоинтов и схему — см. [backend/README.md](backend/README.md).

## Окружение

Все переменные backend описаны в [backend/.env.example](backend/.env.example).
Ключевые:

| Переменная           | Что делает                                                 |
|----------------------|------------------------------------------------------------|
| `DATABASE_URL`       | Подключение к PostgreSQL                                   |
| `JWT_SECRET`         | Секрет подписи JWT (в проде — длинная случайная строка)   |
| `AUTH_EXPOSE_CODE`   | В демо: возвращать код подтверждения email в ответе API   |
| `ADMIN_USERNAME/PASSWORD` | Документация (хэш закладывается в seed)               |
| `RESEED_ON_START`    | `true` — пересоздать схему и накатить seed при старте      |

## Безопасность для деплоя

Перед публикацией:
1. Смени `JWT_SECRET` на случайные ~64 байта.
2. Поставь `AUTH_EXPOSE_CODE=false` и подключи реальную отправку email.
3. Удали учётку `admin/admin1` или поменяй пароль в seed.
4. Сузь `CORS_ORIGINS` до своего домена.

## Лицензия

Учебный проект.
