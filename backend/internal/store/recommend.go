package store

import "context"

// UserAffinity возвращает, сколько видео каждой категории пользователь смотрел —
// сырой сигнал интереса для персонализации рекомендаций.
func (s *Store) UserAffinity(ctx context.Context, userID string) (map[string]float64, error) {
	out := map[string]float64{}
	if userID == "" {
		return out, nil
	}
	rows, err := s.Pool.Query(ctx, `
		SELECT v.category, COUNT(*)::float8
		FROM video_views vv
		JOIN videos v ON v.id = vv.video_id
		WHERE vv.user_id = $1
		GROUP BY v.category`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var cat string
		var n float64
		if err := rows.Scan(&cat, &n); err != nil {
			return nil, err
		}
		out[cat] = n
	}
	return out, rows.Err()
}

// WatchedVideoIDs — множество видео, которые пользователь уже смотрел
// (чтобы не рекомендовать их повторно).
func (s *Store) WatchedVideoIDs(ctx context.Context, userID string) (map[string]bool, error) {
	out := map[string]bool{}
	if userID == "" {
		return out, nil
	}
	rows, err := s.Pool.Query(ctx,
		`SELECT video_id FROM video_views WHERE user_id = $1`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		out[id] = true
	}
	return out, rows.Err()
}

// SubscribedChannelIDs — каналы, на которые подписан пользователь.
func (s *Store) SubscribedChannelIDs(ctx context.Context, userID string) (map[string]bool, error) {
	out := map[string]bool{}
	if userID == "" {
		return out, nil
	}
	rows, err := s.Pool.Query(ctx,
		`SELECT channel_id FROM subscriptions WHERE subscriber_id = $1`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		out[id] = true
	}
	return out, rows.Err()
}

// CoWatch — item-item коллаборативный сигнал: для затравки videoID считает,
// сколько раз каждое другое видео смотрели те же пользователи. Это ядро
// «те, кто смотрел это, смотрели также…».
func (s *Store) CoWatch(ctx context.Context, videoID string, limit int) (map[string]int64, error) {
	out := map[string]int64{}
	if videoID == "" {
		return out, nil
	}
	if limit <= 0 {
		limit = 200
	}
	rows, err := s.Pool.Query(ctx, `
		SELECT other.video_id, COUNT(*)::bigint AS co
		FROM video_views seed
		JOIN video_views other
		  ON other.user_id = seed.user_id
		 AND other.video_id <> seed.video_id
		WHERE seed.video_id = $1
		GROUP BY other.video_id
		ORDER BY co DESC
		LIMIT $2`, videoID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var id string
		var co int64
		if err := rows.Scan(&id, &co); err != nil {
			return nil, err
		}
		out[id] = co
	}
	return out, rows.Err()
}
