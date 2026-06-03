package store

import (
	"context"
	"time"
)

type UploadFile struct {
	Path        string
	ContentType string
	SizeBytes   int64
	Data        []byte
	CreatedAt   time.Time
}

func (s *Store) SaveUploadFile(ctx context.Context, file UploadFile) error {
	_, err := s.Pool.Exec(ctx, `
		INSERT INTO upload_files(path, content_type, size_bytes, data)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (path) DO UPDATE SET
			content_type = EXCLUDED.content_type,
			size_bytes = EXCLUDED.size_bytes,
			data = EXCLUDED.data,
			created_at = NOW()`,
		file.Path, file.ContentType, file.SizeBytes, file.Data)
	return err
}

func (s *Store) GetUploadFile(ctx context.Context, path string) (*UploadFile, error) {
	var file UploadFile
	err := s.Pool.QueryRow(ctx, `
		SELECT path, content_type, size_bytes, data, created_at
		FROM upload_files
		WHERE path = $1`, path).
		Scan(&file.Path, &file.ContentType, &file.SizeBytes, &file.Data, &file.CreatedAt)
	if isNoRows(err) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &file, nil
}
