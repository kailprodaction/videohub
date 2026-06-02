-- =====================================================================
-- Auth: пароли + одноразовые коды подтверждения email
-- =====================================================================

-- Хэш пароля у админа (NULL у обычных пользователей, которые входят по коду).
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Одноразовые коды.
-- kind = 'register' — код подтверждения регистрации; user_id создаётся при verify.
-- kind = 'login'    — код входа существующего пользователя.
CREATE TABLE IF NOT EXISTS auth_codes (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email        TEXT NOT NULL,
    code         TEXT NOT NULL,
    kind         TEXT NOT NULL CHECK (kind IN ('register', 'login')),
    display_name TEXT NOT NULL DEFAULT '',
    used         BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at   TIMESTAMPTZ NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_codes_email_kind ON auth_codes(email, kind, used);
