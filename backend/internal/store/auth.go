package store

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"

	"videohub/internal/models"
)

// CreateAuthCodeParams — параметры для CreateAuthCode.
type CreateAuthCodeParams struct {
	Email        string
	Code         string
	Kind         string // "register"
	DisplayName  string
	Login        string
	PasswordHash string
	TTL          time.Duration
}

// CreateAuthCode сохраняет код подтверждения регистрации вместе с уже
// валидированными login / displayName / password_hash. Старые активные коды
// того же типа для этого email помечаются использованными.
func (s *Store) CreateAuthCode(ctx context.Context, p CreateAuthCodeParams) error {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx,
		`UPDATE auth_codes SET used = TRUE
		 WHERE email = $1 AND kind = $2 AND used = FALSE`,
		p.Email, p.Kind); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO auth_codes(email, code, kind, display_name, login, password_hash, expires_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		p.Email, p.Code, p.Kind, p.DisplayName, p.Login, p.PasswordHash,
		time.Now().Add(p.TTL)); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// AuthCode — строка из таблицы auth_codes, нужна при verify.
type AuthCode struct {
	ID           string
	Email        string
	Code         string
	Kind         string
	DisplayName  string
	Login        string
	PasswordHash string
	ExpiresAt    time.Time
}

// ConsumeAuthCode проверяет код и атомарно отмечает его использованным.
func (s *Store) ConsumeAuthCode(ctx context.Context, email, code, kind string) (*AuthCode, error) {
	var ac AuthCode
	err := s.Pool.QueryRow(ctx, `
		UPDATE auth_codes SET used = TRUE
		WHERE id = (
			SELECT id FROM auth_codes
			WHERE email = $1 AND code = $2 AND kind = $3
			  AND used = FALSE AND expires_at > NOW()
			ORDER BY created_at DESC LIMIT 1
		)
		RETURNING id, email, code, kind, display_name, login, password_hash, expires_at`,
		email, code, kind).
		Scan(&ac.ID, &ac.Email, &ac.Code, &ac.Kind, &ac.DisplayName,
			&ac.Login, &ac.PasswordHash, &ac.ExpiresAt)
	if err == pgx.ErrNoRows {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &ac, nil
}

// GetUserByEmail возвращает пользователя по email или ErrNotFound.
func (s *Store) GetUserByEmail(ctx context.Context, email string) (*models.User, error) {
	var u models.User
	err := scanUser(s.Pool.QueryRow(ctx,
		`SELECT `+userColumns+` FROM users WHERE email = $1`, email), &u)
	if err == pgx.ErrNoRows {
		return nil, ErrNotFound
	}
	return &u, err
}

// GetUserByUsername — для входа по логину + паролю. Возвращает также
// password_hash (пустая строка, если у пользователя его нет).
func (s *Store) GetUserByUsername(ctx context.Context, username string) (*models.User, string, error) {
	var u models.User
	var hash *string
	err := s.Pool.QueryRow(ctx,
		`SELECT `+userColumns+`, password_hash FROM users WHERE username = $1`, username).
		Scan(&u.ID, &u.Username, &u.DisplayName, &u.Email, &u.AvatarURL,
			&u.Bio, &u.Role, &u.Blocked, &u.CreatedAt, &u.Premium, &u.PremiumUntil, &hash)
	if err == pgx.ErrNoRows {
		return nil, "", ErrNotFound
	}
	if err != nil {
		return nil, "", err
	}
	pwd := ""
	if hash != nil {
		pwd = *hash
	}
	return &u, pwd, nil
}

// IsLoginTaken — true, если такой username уже занят.
func (s *Store) IsLoginTaken(ctx context.Context, login string) (bool, error) {
	var exists bool
	err := s.Pool.QueryRow(ctx,
		`SELECT EXISTS (SELECT 1 FROM users WHERE username = $1)`, login).Scan(&exists)
	return exists, err
}

// CreateUserParams — параметры для CreateUserWithChannel.
type CreateUserParams struct {
	Login        string
	DisplayName  string
	Email        string
	PasswordHash string
}

// CreateUserWithChannel создаёт пользователя + связанный канал в одной транзакции.
// login должен быть уникальным; пароль уже захэширован.
func (s *Store) CreateUserWithChannel(ctx context.Context, in CreateUserParams) (*models.User, error) {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	// avatar_url / banner_url оставляем пустыми: пользователь сам загрузит аватарку
	// через личный кабинет. На фронте Avatar-компонент рисует заглушку.
	var u models.User
	if err := scanUser(tx.QueryRow(ctx, `
		INSERT INTO users (username, display_name, email, avatar_url, bio, role, password_hash)
		VALUES ($1, $2, $3, '', '', 'user', NULLIF($4, ''))
		RETURNING `+userColumns,
		in.Login, in.DisplayName, in.Email, in.PasswordHash), &u); err != nil {
		return nil, err
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO channels (owner_id, name, handle, description, avatar_url, banner_url)
		VALUES ($1, $2, '@' || $3, '', '', '')`,
		u.ID, in.DisplayName, in.Login); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return &u, nil
}
