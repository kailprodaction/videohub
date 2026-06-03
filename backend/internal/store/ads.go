package store

import (
	"context"

	"github.com/jackc/pgx/v5"

	"videohub/internal/models"
)

const adColumns = `id, title, description, video_url, active, created_at, updated_at`

func scanAd(row interface{ Scan(...any) error }, a *models.Ad) error {
	return row.Scan(&a.ID, &a.Title, &a.Description, &a.VideoURL, &a.Active, &a.CreatedAt, &a.UpdatedAt)
}

func (s *Store) ListAds(ctx context.Context) ([]models.Ad, error) {
	rows, err := s.Pool.Query(ctx, `SELECT `+adColumns+` FROM ads ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]models.Ad, 0)
	for rows.Next() {
		var a models.Ad
		if err := scanAd(rows, &a); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

func (s *Store) GetAd(ctx context.Context, id string) (*models.Ad, error) {
	var a models.Ad
	err := scanAd(s.Pool.QueryRow(ctx,
		`SELECT `+adColumns+` FROM ads WHERE id=$1`, id), &a)
	if err == pgx.ErrNoRows {
		return nil, ErrNotFound
	}
	return &a, err
}

// GetRandomActiveAd возвращает случайную активную рекламу или ErrNotFound.
func (s *Store) GetRandomActiveAd(ctx context.Context) (*models.Ad, error) {
	var a models.Ad
	err := scanAd(s.Pool.QueryRow(ctx,
		`SELECT `+adColumns+` FROM ads WHERE active=TRUE ORDER BY random() LIMIT 1`), &a)
	if err == pgx.ErrNoRows {
		return nil, ErrNotFound
	}
	return &a, err
}

type CreateAdParams struct {
	Title       string
	Description string
	VideoURL    string
	Active      bool
}

func (s *Store) CreateAd(ctx context.Context, p CreateAdParams) (*models.Ad, error) {
	var a models.Ad
	err := scanAd(s.Pool.QueryRow(ctx, `
		INSERT INTO ads(title, description, video_url, active)
		VALUES ($1, $2, $3, $4)
		RETURNING `+adColumns,
		p.Title, p.Description, p.VideoURL, p.Active), &a)
	return &a, err
}

type UpdateAdParams struct {
	Title       *string
	Description *string
	VideoURL    *string
	Active      *bool
}

func (s *Store) UpdateAd(ctx context.Context, id string, p UpdateAdParams) error {
	_, err := s.Pool.Exec(ctx, `
		UPDATE ads SET
			title       = COALESCE($2, title),
			description = COALESCE($3, description),
			video_url   = COALESCE($4, video_url),
			active      = COALESCE($5, active),
			updated_at  = NOW()
		WHERE id=$1`,
		id, p.Title, p.Description, p.VideoURL, p.Active)
	return err
}

func (s *Store) DeleteAd(ctx context.Context, id string) error {
	_, err := s.Pool.Exec(ctx, `DELETE FROM ads WHERE id=$1`, id)
	return err
}
