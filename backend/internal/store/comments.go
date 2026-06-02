package store

import (
	"context"

	"videohub/internal/models"
)

func (s *Store) ListComments(ctx context.Context, videoID string) ([]models.Comment, error) {
	rows, err := s.Pool.Query(ctx, `
		SELECT id, video_id, author_id, text, likes, created_at
		FROM comments WHERE video_id=$1 ORDER BY created_at DESC`, videoID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]models.Comment, 0)
	for rows.Next() {
		var c models.Comment
		if err := rows.Scan(&c.ID, &c.VideoID, &c.AuthorID, &c.Text, &c.Likes, &c.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (s *Store) ListAllComments(ctx context.Context) ([]models.Comment, error) {
	rows, err := s.Pool.Query(ctx, `
		SELECT id, video_id, author_id, text, likes, created_at
		FROM comments ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]models.Comment, 0)
	for rows.Next() {
		var c models.Comment
		if err := rows.Scan(&c.ID, &c.VideoID, &c.AuthorID, &c.Text, &c.Likes, &c.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (s *Store) AddComment(ctx context.Context, videoID, authorID, text string) (*models.Comment, error) {
	var c models.Comment
	err := s.Pool.QueryRow(ctx, `
		INSERT INTO comments(video_id, author_id, text)
		VALUES ($1, $2, $3)
		RETURNING id, video_id, author_id, text, likes, created_at`,
		videoID, authorID, text).
		Scan(&c.ID, &c.VideoID, &c.AuthorID, &c.Text, &c.Likes, &c.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (s *Store) DeleteComment(ctx context.Context, id string) error {
	_, err := s.Pool.Exec(ctx, `DELETE FROM comments WHERE id=$1`, id)
	return err
}
