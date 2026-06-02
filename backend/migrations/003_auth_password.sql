-- =====================================================================
-- Перевод авторизации на схему "login + password" с подтверждением email.
-- =====================================================================

-- Регистрация теперь сохраняет логин и хэш пароля во временной записи
-- auth_codes, пока пользователь не подтвердит почту кодом.
ALTER TABLE auth_codes ADD COLUMN IF NOT EXISTS login         TEXT NOT NULL DEFAULT '';
ALTER TABLE auth_codes ADD COLUMN IF NOT EXISTS password_hash TEXT NOT NULL DEFAULT '';
