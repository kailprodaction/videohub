-- =====================================================================
-- Поддержка ручной накрутки счётчиков ОТДЕЛЬНОГО видео админом.
-- =====================================================================

-- Журнал событий теперь может ссылаться на конкретное видео
-- (NULL = операция на уровне канала, иначе — точечная на видео).
ALTER TABLE admin_stat_events
    ADD COLUMN IF NOT EXISTS video_id UUID REFERENCES videos(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_admin_stat_video ON admin_stat_events(video_id, created_at);
