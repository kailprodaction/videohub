package store

import (
	"context"
	"time"

	"videohub/internal/models"
)

const statsDays = 14

// ChannelStats считает 14-дневную статистику канала: просмотры, лайки/дизлайки и
// прирост/отток подписчиков по дням, с учётом админских оверрайдов.
func (s *Store) ChannelStats(ctx context.Context, channelID string) (*models.ChannelStats, error) {
	override, err := s.GetOverride(ctx, channelID)
	if err != nil {
		return nil, err
	}

	// Заготовка точек на N последних дней (даже если в эти дни не было активности).
	today := time.Now().UTC().Truncate(24 * time.Hour)
	dateIndex := make(map[string]int, statsDays)
	points := make([]models.StatsPoint, statsDays)
	for i := 0; i < statsDays; i++ {
		d := today.AddDate(0, 0, -(statsDays - 1 - i))
		key := d.Format("2006-01-02")
		points[i].Date = key
		dateIndex[key] = i
	}

	// Просмотры по дням
	rows, err := s.Pool.Query(ctx, `
		SELECT TO_CHAR(DATE_TRUNC('day', vv.created_at) AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day,
		       COUNT(*) AS c
		FROM video_views vv
		JOIN videos v ON v.id = vv.video_id
		WHERE v.channel_id = $1 AND vv.created_at >= $2
		GROUP BY 1`, channelID, today.AddDate(0, 0, -(statsDays-1)))
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var day string
		var c int64
		if err := rows.Scan(&day, &c); err != nil {
			rows.Close()
			return nil, err
		}
		if idx, ok := dateIndex[day]; ok {
			points[idx].Views = c
		}
	}
	rows.Close()

	// Лайки / Дизлайки по дням (по событиям, где новая реакция == like/dislike).
	rows, err = s.Pool.Query(ctx, `
		SELECT TO_CHAR(DATE_TRUNC('day', re.created_at) AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day,
		       re.new_reaction,
		       COUNT(*)
		FROM reaction_events re
		JOIN videos v ON v.id = re.video_id
		WHERE v.channel_id = $1 AND re.created_at >= $2
		  AND re.new_reaction IN ('like', 'dislike')
		GROUP BY 1, 2`, channelID, today.AddDate(0, 0, -(statsDays-1)))
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var day, kind string
		var c int64
		if err := rows.Scan(&day, &kind, &c); err != nil {
			rows.Close()
			return nil, err
		}
		if idx, ok := dateIndex[day]; ok {
			if kind == "like" {
				points[idx].Likes = c
			} else {
				points[idx].Dislikes = c
			}
		}
	}
	rows.Close()

	// Подписки / отписки по дням.
	rows, err = s.Pool.Query(ctx, `
		SELECT TO_CHAR(DATE_TRUNC('day', created_at) AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day,
		       action,
		       COUNT(*)
		FROM subscription_events
		WHERE channel_id = $1 AND created_at >= $2
		GROUP BY 1, 2`, channelID, today.AddDate(0, 0, -(statsDays-1)))
	if err != nil {
		return nil, err
	}
	subsPerDay := map[int]int64{}
	unsubsPerDay := map[int]int64{}
	for rows.Next() {
		var day, action string
		var c int64
		if err := rows.Scan(&day, &action, &c); err != nil {
			rows.Close()
			return nil, err
		}
		if idx, ok := dateIndex[day]; ok {
			if action == "subscribe" {
				subsPerDay[idx] += c
			} else {
				unsubsPerDay[idx] += c
			}
		}
	}
	rows.Close()
	for i := range points {
		points[i].Subscribers = subsPerDay[i] - unsubsPerDay[i]
	}

	// Распределяем админ-оверрайды равномерно по дням, чтобы изменения админа были видны на графиках.
	if statsDays > 0 {
		spread := func(total int64) int64 {
			if total == 0 {
				return 0
			}
			return total / int64(statsDays)
		}
		dV, dL, dD, dS := spread(override.Views), spread(override.Likes), spread(override.Dislikes), spread(override.Subscribers)
		for i := range points {
			points[i].Views += dV
			points[i].Likes += dL
			points[i].Dislikes += dD
			points[i].Subscribers += dS
			points[i].Views = maxInt64(points[i].Views, 0)
			points[i].Likes = maxInt64(points[i].Likes, 0)
			points[i].Dislikes = maxInt64(points[i].Dislikes, 0)
			points[i].Subscribers = maxInt64(points[i].Subscribers, 0)
		}
	}

	// Последние подписавшиеся / отписавшиеся.
	subRecent, err := s.recentSubscribers(ctx, channelID, "subscribe", 8)
	if err != nil {
		return nil, err
	}
	unsubRecent, err := s.recentSubscribers(ctx, channelID, "unsubscribe", 8)
	if err != nil {
		return nil, err
	}

	// Тоталы.
	var totViews, totLikes, totDislikes int64
	if err := s.Pool.QueryRow(ctx, `
		SELECT
			COALESCE(SUM(views_count), 0),
			COALESCE(SUM(likes_count), 0),
			COALESCE(SUM(dislikes_count), 0)
		FROM videos WHERE channel_id=$1`, channelID).
		Scan(&totViews, &totLikes, &totDislikes); err != nil {
		return nil, err
	}
	totViews += override.Views
	totLikes += override.Likes
	totDislikes += override.Dislikes
	totViews = maxInt64(totViews, 0)
	totLikes = maxInt64(totLikes, 0)
	totDislikes = maxInt64(totDislikes, 0)

	var totSubs int64
	if err := s.Pool.QueryRow(ctx,
		`SELECT GREATEST(subscribers_count + COALESCE((SELECT subscribers FROM channel_overrides WHERE channel_id=$1), 0), 0)
		 FROM channels WHERE id=$1`, channelID).Scan(&totSubs); err != nil {
		return nil, err
	}

	return &models.ChannelStats{
		ChannelID:            channelID,
		Points:               points,
		SubscribedRecently:   subRecent,
		UnsubscribedRecently: unsubRecent,
		TotalViews:           totViews,
		TotalLikes:           totLikes,
		TotalDislikes:        totDislikes,
		TotalSubscribers:     totSubs,
	}, nil
}

func (s *Store) recentSubscribers(ctx context.Context, channelID, action string, limit int) ([]string, error) {
	rows, err := s.Pool.Query(ctx, `
		SELECT subscriber_id FROM subscription_events
		WHERE channel_id=$1 AND action=$2
		ORDER BY created_at DESC LIMIT $3`, channelID, action, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]string, 0)
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		out = append(out, id)
	}
	return out, rows.Err()
}

// PlatformStats отдаёт сводную статистику платформы для админ-панели.
func (s *Store) PlatformStats(ctx context.Context) (*models.PlatformStats, error) {
	var ps models.PlatformStats
	if err := s.Pool.QueryRow(ctx, `
		SELECT
			(SELECT COUNT(*) FROM users),
			(SELECT COUNT(*) FROM channels),
			(SELECT COUNT(*) FROM videos),
			GREATEST((SELECT COALESCE(SUM(views_count), 0) FROM videos)
			  + COALESCE((SELECT SUM(views) FROM channel_overrides), 0), 0),
			(SELECT COUNT(*) FROM comments)
		`).Scan(&ps.TotalUsers, &ps.TotalChannels, &ps.TotalVideos, &ps.TotalViews, &ps.TotalComments); err != nil {
		return nil, err
	}

	today := time.Now().UTC().Truncate(24 * time.Hour)
	from := today.AddDate(0, 0, -(statsDays - 1))
	rows, err := s.Pool.Query(ctx, `
		SELECT TO_CHAR(DATE_TRUNC('day', created_at) AT TIME ZONE 'UTC', 'YYYY-MM-DD'),
		       COUNT(DISTINCT user_id)
		FROM video_views
		WHERE created_at >= $1 AND user_id IS NOT NULL
		GROUP BY 1`, from)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	counts := make(map[string]int64)
	for rows.Next() {
		var d string
		var c int64
		if err := rows.Scan(&d, &c); err != nil {
			return nil, err
		}
		counts[d] = c
	}
	for i := 0; i < statsDays; i++ {
		d := from.AddDate(0, 0, i).Format("2006-01-02")
		ps.DailyActive = append(ps.DailyActive, models.DailyActivityPoint{Date: d, Count: counts[d]})
	}
	return &ps, nil
}

func maxInt64(a, b int64) int64 {
	if a > b {
		return a
	}
	return b
}
