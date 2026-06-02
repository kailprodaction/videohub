-- =====================================================================
-- VideoHub initial schema
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------
-- Пользователи
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username      TEXT NOT NULL UNIQUE,
    display_name  TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    avatar_url    TEXT NOT NULL DEFAULT '',
    bio           TEXT NOT NULL DEFAULT '',
    role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    blocked       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- Каналы (у каждого пользователя ровно один канал)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS channels (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name               TEXT NOT NULL,
    handle             TEXT NOT NULL UNIQUE,
    description        TEXT NOT NULL DEFAULT '',
    avatar_url         TEXT NOT NULL DEFAULT '',
    banner_url         TEXT NOT NULL DEFAULT '',
    subscribers_count  BIGINT NOT NULL DEFAULT 0,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (owner_id)
);

-- ---------------------------------------------------------------------
-- Видео
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS videos (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id      UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    description     TEXT NOT NULL DEFAULT '',
    thumbnail_url   TEXT NOT NULL DEFAULT '',
    video_url       TEXT NOT NULL DEFAULT '',
    duration_sec    INT  NOT NULL DEFAULT 0,
    views_count     BIGINT NOT NULL DEFAULT 0,
    likes_count     BIGINT NOT NULL DEFAULT 0,
    dislikes_count  BIGINT NOT NULL DEFAULT 0,
    category        TEXT NOT NULL DEFAULT 'other',
    visibility      TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
    tags            TEXT[] NOT NULL DEFAULT '{}',
    uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_videos_channel    ON videos(channel_id);
CREATE INDEX IF NOT EXISTS idx_videos_uploaded   ON videos(uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_videos_category   ON videos(category);

-- ---------------------------------------------------------------------
-- Комментарии
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS comments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id    UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    author_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text        TEXT NOT NULL,
    likes       INT  NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_video ON comments(video_id, created_at DESC);

-- ---------------------------------------------------------------------
-- Реакции (лайки/дизлайки). Один пользователь — одна реакция на видео.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS video_reactions (
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    video_id    UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    reaction    CHAR(1) NOT NULL CHECK (reaction IN ('L', 'D')),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, video_id)
);

-- Журнал событий реакций (для статистики по дням).
CREATE TABLE IF NOT EXISTS reaction_events (
    id            BIGSERIAL PRIMARY KEY,
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    video_id      UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    new_reaction  TEXT NOT NULL CHECK (new_reaction IN ('like', 'dislike', 'none')),
    prev_reaction TEXT NOT NULL CHECK (prev_reaction IN ('like', 'dislike', 'none')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reaction_events_video ON reaction_events(video_id, created_at);

-- ---------------------------------------------------------------------
-- Просмотры (каждый просмотр — отдельная запись для дневной статистики)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS video_views (
    id          BIGSERIAL PRIMARY KEY,
    video_id    UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_views_video    ON video_views(video_id, created_at);
CREATE INDEX IF NOT EXISTS idx_views_date     ON video_views(created_at);

-- ---------------------------------------------------------------------
-- Подписки + журнал событий подписок/отписок
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscriptions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscriber_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel_id      UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (subscriber_id, channel_id)
);

CREATE TABLE IF NOT EXISTS subscription_events (
    id              BIGSERIAL PRIMARY KEY,
    subscriber_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel_id      UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    action          TEXT NOT NULL CHECK (action IN ('subscribe', 'unsubscribe')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sub_events_channel ON subscription_events(channel_id, created_at);

-- ---------------------------------------------------------------------
-- Накопительные админ-оверрайды на канал.
-- При выдаче применяются как дельты к реальным счётчикам канала и его видео.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS channel_overrides (
    channel_id   UUID PRIMARY KEY REFERENCES channels(id) ON DELETE CASCADE,
    views        BIGINT NOT NULL DEFAULT 0,
    likes        BIGINT NOT NULL DEFAULT 0,
    dislikes     BIGINT NOT NULL DEFAULT 0,
    subscribers  BIGINT NOT NULL DEFAULT 0,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Журнал админских правок для возможного аудита и графиков.
CREATE TABLE IF NOT EXISTS admin_stat_events (
    id          BIGSERIAL PRIMARY KEY,
    channel_id  UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    kind        TEXT NOT NULL CHECK (kind IN ('views', 'likes', 'dislikes', 'subscribers')),
    delta       BIGINT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_stat_channel ON admin_stat_events(channel_id, created_at);
