package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5/pgconn"
	"videohub/internal/models"
)

// ErrDuplicateReport — пользователь уже подал открытую жалобу на этот объект.
var ErrDuplicateReport = errors.New("duplicate report")

// CreateReport добавляет жалобу. priority вычисляется из типа причины и типа
// объекта (жалобы на видео важнее, чем на комментарии; nudity/violence — выше).
func (s *Store) CreateReport(ctx context.Context, in models.Report) (*models.Report, error) {
	priority := reportPriority(in.TargetType, in.Reason)
	var r models.Report
	err := s.Pool.QueryRow(ctx, `
		INSERT INTO reports(target_type, target_id, reporter_id, reason, details, priority)
		VALUES ($1,$2,$3,$4,$5,$6)
		RETURNING id, target_type, target_id, reporter_id, reason, details, status,
		          priority, resolution, resolved_by, resolved_at, created_at`,
		in.TargetType, in.TargetID, in.ReporterID, in.Reason, in.Details, priority).
		Scan(&r.ID, &r.TargetType, &r.TargetID, &r.ReporterID, &r.Reason, &r.Details, &r.Status,
			&r.Priority, &r.Resolution, &r.ResolvedBy, &r.ResolvedAt, &r.CreatedAt)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" { // unique_violation
			return nil, ErrDuplicateReport
		}
		return nil, err
	}
	return &r, nil
}

// reportPriority — простая эвристика приоритезации очереди модерации.
func reportPriority(targetType, reason string) int {
	p := 0
	switch reason {
	case "nudity", "violence":
		p += 30
	case "hate", "copyright":
		p += 20
	case "misinformation":
		p += 15
	case "spam":
		p += 5
	}
	switch targetType {
	case "video":
		p += 10 // публичный контент приоритетнее
	case "channel":
		p += 8
	case "comment":
		p += 2
	}
	return p
}

// ListReports для админа. status="" — все; иначе фильтр по статусу.
// Открытые сортируются по приоритету и дате (важное и старое — вверху).
func (s *Store) ListReports(ctx context.Context, status string, limit int) ([]models.Report, error) {
	if limit <= 0 {
		limit = 200
	}
	args := []any{limit}
	where := ""
	if status != "" {
		where = "WHERE r.status = $2"
		args = append(args, status)
	}
	// LEFT JOIN на видео/комментарии — подтягиваем заголовок/текст объекта.
	rows, err := s.Pool.Query(ctx, `
		SELECT r.id, r.target_type, r.target_id, r.reporter_id, r.reason, r.details,
		       r.status, r.priority, r.resolution, r.resolved_by, r.resolved_at, r.created_at,
		       COALESCE(v.title, LEFT(cm.text, 80), ch.name, '') AS target_title
		FROM reports r
		LEFT JOIN videos   v  ON r.target_type = 'video'   AND v.id  = r.target_id
		LEFT JOIN comments cm ON r.target_type = 'comment' AND cm.id = r.target_id
		LEFT JOIN channels ch ON r.target_type = 'channel' AND ch.id = r.target_id
		`+where+`
		ORDER BY (r.status IN ('open','reviewing')) DESC, r.priority DESC, r.created_at ASC
		LIMIT $1`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]models.Report, 0)
	for rows.Next() {
		var r models.Report
		if err := rows.Scan(&r.ID, &r.TargetType, &r.TargetID, &r.ReporterID, &r.Reason, &r.Details,
			&r.Status, &r.Priority, &r.Resolution, &r.ResolvedBy, &r.ResolvedAt, &r.CreatedAt,
			&r.TargetTitle); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

// CountOpenReports — число необработанных жалоб (для бейджа в админке).
func (s *Store) CountOpenReports(ctx context.Context) (int64, error) {
	var n int64
	err := s.Pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM reports WHERE status IN ('open','reviewing')`).Scan(&n)
	return n, err
}

// ResolveReport меняет статус жалобы и фиксирует, кто и как её закрыл.
func (s *Store) ResolveReport(ctx context.Context, id, status, resolution, adminID string) error {
	tag, err := s.Pool.Exec(ctx, `
		UPDATE reports SET
			status = $2,
			resolution = $3,
			resolved_by = $4,
			resolved_at = CASE WHEN $2 IN ('resolved','dismissed') THEN NOW() ELSE NULL END
		WHERE id = $1`, id, status, resolution, adminID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}
