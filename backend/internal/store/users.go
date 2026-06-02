package store

import (
	"context"

	"videohub/internal/models"
)

func (s *Store) ListUsers(ctx context.Context) ([]models.User, error) {
	rows, err := s.Pool.Query(ctx, `
		SELECT id, username, display_name, email, avatar_url, bio, role, blocked, created_at
		FROM users ORDER BY created_at`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]models.User, 0)
	for rows.Next() {
		var u models.User
		if err := rows.Scan(&u.ID, &u.Username, &u.DisplayName, &u.Email, &u.AvatarURL, &u.Bio, &u.Role, &u.Blocked, &u.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	return out, rows.Err()
}

func (s *Store) GetUser(ctx context.Context, id string) (*models.User, error) {
	var u models.User
	err := s.Pool.QueryRow(ctx, `
		SELECT id, username, display_name, email, avatar_url, bio, role, blocked, created_at
		FROM users WHERE id=$1`, id).
		Scan(&u.ID, &u.Username, &u.DisplayName, &u.Email, &u.AvatarURL, &u.Bio, &u.Role, &u.Blocked, &u.CreatedAt)
	if isNoRows(err) {
		return nil, ErrNotFound
	}
	return &u, err
}

func (s *Store) UpdateProfile(ctx context.Context, id string, displayName, bio, avatarURL *string) error {
	_, err := s.Pool.Exec(ctx, `
		UPDATE users SET
			display_name = COALESCE($2, display_name),
			bio          = COALESCE($3, bio),
			avatar_url   = COALESCE($4, avatar_url)
		WHERE id=$1`,
		id, displayName, bio, avatarURL)
	return err
}

func (s *Store) SetBlocked(ctx context.Context, id string, blocked bool) error {
	_, err := s.Pool.Exec(ctx, `UPDATE users SET blocked=$2 WHERE id=$1`, id, blocked)
	return err
}
