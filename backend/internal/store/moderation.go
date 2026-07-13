package store

import (
	"context"

	"videohub/internal/models"
)

// SaveModerationResult пишет прогон ML-модерации и (при source='ml') выставляет
// видео итоговый moderation_status — всё в одной транзакции.
func (s *Store) SaveModerationResult(ctx context.Context, m models.ModerationRecord) error {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `
		INSERT INTO moderation_results
			(video_id, nudity_score, copyright_score, spam_score, violence_score,
			 overall_score, decision, labels, sanction, source, reviewed_by, reviewed_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
		m.VideoID, m.NudityScore, m.CopyrightScore, m.SpamScore, m.ViolenceScore,
		m.OverallScore, m.Decision, m.Labels, m.Sanction, m.Source, m.ReviewedBy, m.ReviewedAt); err != nil {
		return err
	}
	if m.Status != "" {
		if _, err := tx.Exec(ctx,
			`UPDATE videos SET moderation_status = $2 WHERE id = $1`, m.VideoID, m.Status); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

// SetModerationStatus — ручное решение модератора: меняет статус видео и пишет
// строку в moderation_results с source='moderator' для audit trail.
func (s *Store) SetModerationStatus(ctx context.Context, videoID, status, sanction, moderatorID string) error {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	tag, err := tx.Exec(ctx,
		`UPDATE videos SET moderation_status = $2 WHERE id = $1`, videoID, status)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO moderation_results
			(video_id, decision, sanction, source, reviewed_by, reviewed_at)
		VALUES ($1, $2, $3, 'moderator', $4, NOW())`,
		videoID, "manual_"+status, sanction, moderatorID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// ModerationQueue возвращает последний результат модерации по каждому видео,
// у которого статус не 'approved' (или decision требует внимания) — очередь модератора.
func (s *Store) ModerationQueue(ctx context.Context, limit int) ([]models.ModerationRecord, error) {
	if limit <= 0 {
		limit = 100
	}
	rows, err := s.Pool.Query(ctx, `
		SELECT DISTINCT ON (m.video_id)
			m.id, m.video_id, v.title, m.nudity_score, m.copyright_score, m.spam_score,
			m.violence_score, m.overall_score, m.decision, m.labels, m.sanction, m.source,
			v.moderation_status, m.reviewed_by, m.reviewed_at, m.created_at
		FROM moderation_results m
		JOIN videos v ON v.id = m.video_id
		WHERE v.moderation_status IN ('pending','blocked','shadow')
		ORDER BY m.video_id, m.created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]models.ModerationRecord, 0)
	for rows.Next() {
		m, err := scanModeration(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	// DISTINCT ON требует сортировки по video_id; пересортируем по риску.
	sortByRiskDesc(out)
	if len(out) > limit {
		out = out[:limit]
	}
	return out, nil
}

// LatestModeration — последний прогон модерации по конкретному видео.
func (s *Store) LatestModeration(ctx context.Context, videoID string) (*models.ModerationRecord, error) {
	row := s.Pool.QueryRow(ctx, `
		SELECT m.id, m.video_id, v.title, m.nudity_score, m.copyright_score, m.spam_score,
		       m.violence_score, m.overall_score, m.decision, m.labels, m.sanction, m.source,
		       v.moderation_status, m.reviewed_by, m.reviewed_at, m.created_at
		FROM moderation_results m
		JOIN videos v ON v.id = m.video_id
		WHERE m.video_id = $1
		ORDER BY m.created_at DESC
		LIMIT 1`, videoID)
	m, err := scanModeration(row)
	if isNoRows(err) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func scanModeration(row rowScanner) (models.ModerationRecord, error) {
	var m models.ModerationRecord
	err := row.Scan(&m.ID, &m.VideoID, &m.VideoTitle, &m.NudityScore, &m.CopyrightScore, &m.SpamScore,
		&m.ViolenceScore, &m.OverallScore, &m.Decision, &m.Labels, &m.Sanction, &m.Source,
		&m.Status, &m.ReviewedBy, &m.ReviewedAt, &m.CreatedAt)
	return m, err
}

func sortByRiskDesc(rs []models.ModerationRecord) {
	for i := 1; i < len(rs); i++ {
		for j := i; j > 0 && rs[j].OverallScore > rs[j-1].OverallScore; j-- {
			rs[j], rs[j-1] = rs[j-1], rs[j]
		}
	}
}
