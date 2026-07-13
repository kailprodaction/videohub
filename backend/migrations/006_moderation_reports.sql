-- =====================================================================
-- Модерация контента + жалобы пользователей (Trust & Safety).
--
-- Идея: каждое загруженное видео проходит ML-проверку (см. internal/ml).
-- Классификатор возвращает вероятности по меткам (nudity/copyright/spam/
-- violence), из которых считается общий risk-score. По порогам (см. DMN-
-- матрицу в ml/moderation.go) видео получает решение:
--   score >= 0.80  → auto_block  (moderation_status = 'blocked')
--   0.40..0.80     → manual_review (moderation_status = 'pending')
--   score < 0.40   → approved   (moderation_status = 'approved')
--
-- Жалобы пользователей складываются в очередь модерации с приоритетом:
-- жалобы на прямые эфиры и на уже опубликованный контент — выше по очереди.
-- =====================================================================

-- ---------------- Статус модерации на видео ----------------
-- approved  — прошло проверку, показывается в лентах
-- pending   — на ручной модерации (0.4..0.8), скрыто из публичных лент
-- blocked   — заблокировано автоматически или модератором
-- shadow    — теневой бан: доступно по прямой ссылке, но не в рекомендациях
ALTER TABLE videos ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'approved'
    CHECK (moderation_status IN ('approved', 'pending', 'blocked', 'shadow'));

CREATE INDEX IF NOT EXISTS idx_videos_moderation ON videos(moderation_status);

-- ---------------- Результаты ML-модерации ----------------
-- Одна строка на прогон классификатора. Хранит покомпонентные скоры,
-- итоговое решение и (если применялась) санкцию из DMN-матрицы.
CREATE TABLE IF NOT EXISTS moderation_results (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id        UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    nudity_score    DOUBLE PRECISION NOT NULL DEFAULT 0,
    copyright_score DOUBLE PRECISION NOT NULL DEFAULT 0,
    spam_score      DOUBLE PRECISION NOT NULL DEFAULT 0,
    violence_score  DOUBLE PRECISION NOT NULL DEFAULT 0,
    overall_score   DOUBLE PRECISION NOT NULL DEFAULT 0,
    -- решение автоматики: approved | manual_review | auto_block
    decision        TEXT NOT NULL,
    -- метки-триггеры (что именно сработало) — для объяснимости
    labels          TEXT[] NOT NULL DEFAULT '{}',
    -- санкция из DMN-матрицы «тип нарушения → санкция»
    sanction        TEXT NOT NULL DEFAULT 'none',
    -- источник решения: 'ml' (автомат) | 'moderator' (человек)
    source          TEXT NOT NULL DEFAULT 'ml',
    reviewed_by     UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at     TIMESTAMPTZ NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_moderation_video   ON moderation_results(video_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_moderation_decision ON moderation_results(decision, created_at DESC);

-- ---------------- Жалобы пользователей ----------------
-- target_type: video | comment | channel
-- reason:      spam | nudity | violence | copyright | hate | misinformation | other
-- status:      open | reviewing | resolved | dismissed
-- priority:    больше = важнее (прямые эфиры/массовые жалобы поднимаются вверх)
CREATE TABLE IF NOT EXISTS reports (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_type  TEXT NOT NULL CHECK (target_type IN ('video', 'comment', 'channel')),
    target_id    UUID NOT NULL,
    reporter_id  UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    reason       TEXT NOT NULL CHECK (reason IN (
                     'spam', 'nudity', 'violence', 'copyright',
                     'hate', 'misinformation', 'other'
                 )),
    details      TEXT NOT NULL DEFAULT '',
    status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN (
                     'open', 'reviewing', 'resolved', 'dismissed'
                 )),
    priority     INT  NOT NULL DEFAULT 0,
    resolution   TEXT NOT NULL DEFAULT '',
    resolved_by  UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    resolved_at  TIMESTAMPTZ NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_status   ON reports(status, priority DESC, created_at);
CREATE INDEX IF NOT EXISTS idx_reports_target   ON reports(target_type, target_id);
-- Один пользователь — одна открытая жалоба на один объект (анти-флуд).
CREATE UNIQUE INDEX IF NOT EXISTS uq_reports_open
    ON reports(target_type, target_id, reporter_id)
    WHERE status IN ('open', 'reviewing') AND reporter_id IS NOT NULL;
