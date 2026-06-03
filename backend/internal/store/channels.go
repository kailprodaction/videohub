package store

import (
	"context"

	"videohub/internal/models"
)

// channelSelect возвращает строки канала с уже применёнными админ-оверрайдами.
const channelSelect = `
SELECT
	c.id,
	c.owner_id,
	c.name,
	c.handle,
	c.description,
	c.avatar_url,
	c.banner_url,
	GREATEST(c.subscribers_count + COALESCE(o.subscribers, 0), 0) AS subscribers_count,
	c.created_at
FROM channels c
LEFT JOIN channel_overrides o ON o.channel_id = c.id
`

func (s *Store) ListChannels(ctx context.Context) ([]models.Channel, error) {
	rows, err := s.Pool.Query(ctx, channelSelect+" ORDER BY c.created_at")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]models.Channel, 0)
	for rows.Next() {
		var c models.Channel
		if err := rows.Scan(&c.ID, &c.OwnerID, &c.Name, &c.Handle, &c.Description, &c.AvatarURL, &c.BannerURL, &c.SubscribersCount, &c.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (s *Store) GetChannel(ctx context.Context, id string) (*models.Channel, error) {
	var c models.Channel
	err := s.Pool.QueryRow(ctx, channelSelect+" WHERE c.id=$1", id).
		Scan(&c.ID, &c.OwnerID, &c.Name, &c.Handle, &c.Description, &c.AvatarURL, &c.BannerURL, &c.SubscribersCount, &c.CreatedAt)
	if isNoRows(err) {
		return nil, ErrNotFound
	}
	return &c, err
}

func (s *Store) GetChannelByOwner(ctx context.Context, ownerID string) (*models.Channel, error) {
	var c models.Channel
	err := s.Pool.QueryRow(ctx, channelSelect+" WHERE c.owner_id=$1", ownerID).
		Scan(&c.ID, &c.OwnerID, &c.Name, &c.Handle, &c.Description, &c.AvatarURL, &c.BannerURL, &c.SubscribersCount, &c.CreatedAt)
	if isNoRows(err) {
		return nil, ErrNotFound
	}
	return &c, err
}

func (s *Store) UpdateChannelProfile(ctx context.Context, channelID string, name, description, avatarURL *string) error {
	_, err := s.Pool.Exec(ctx, `
		UPDATE channels SET
			name        = COALESCE($2, name),
			description = COALESCE($3, description),
			avatar_url  = COALESCE($4, avatar_url)
		WHERE id=$1`,
		channelID, name, description, avatarURL)
	return err
}

func (s *Store) AdminAdjustStats(ctx context.Context, channelID string, views, likes, dislikes, subscribers int64) error {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var appliedViews, appliedLikes, appliedDislikes, appliedSubscribers int64
	if err := tx.QueryRow(ctx, `
		WITH base AS (
			SELECT
				c.id AS channel_id,
				c.subscribers_count,
				COALESCE(SUM(v.views_count), 0) AS views_count,
				COALESCE(SUM(v.likes_count), 0) AS likes_count,
				COALESCE(SUM(v.dislikes_count), 0) AS dislikes_count
			FROM channels c
			LEFT JOIN videos v ON v.channel_id = c.id
			WHERE c.id = $1
			GROUP BY c.id, c.subscribers_count
		),
		current AS (
			SELECT
				b.channel_id,
				b.subscribers_count,
				b.views_count,
				b.likes_count,
				b.dislikes_count,
				COALESCE(o.views, 0) AS views,
				COALESCE(o.likes, 0) AS likes,
				COALESCE(o.dislikes, 0) AS dislikes,
				COALESCE(o.subscribers, 0) AS subscribers
			FROM base b
			LEFT JOIN channel_overrides o ON o.channel_id = b.channel_id
		),
		next_values AS (
			SELECT
				channel_id,
				GREATEST(views_count + views + $2, 0) - views_count AS views,
				GREATEST(likes_count + likes + $3, 0) - likes_count AS likes,
				GREATEST(dislikes_count + dislikes + $4, 0) - dislikes_count AS dislikes,
				GREATEST(subscribers_count + subscribers + $5, 0) - subscribers_count AS subscribers
			FROM current
		),
		upserted AS (
			INSERT INTO channel_overrides(channel_id, views, likes, dislikes, subscribers)
			SELECT channel_id, views, likes, dislikes, subscribers FROM next_values
			ON CONFLICT (channel_id) DO UPDATE SET
				views       = EXCLUDED.views,
				likes       = EXCLUDED.likes,
				dislikes    = EXCLUDED.dislikes,
				subscribers = EXCLUDED.subscribers,
				updated_at  = NOW()
			RETURNING channel_id, views, likes, dislikes, subscribers
		)
		SELECT
			u.views - c.views,
			u.likes - c.likes,
			u.dislikes - c.dislikes,
			u.subscribers - c.subscribers
		FROM upserted u
		JOIN current c ON c.channel_id = u.channel_id`,
		channelID, views, likes, dislikes, subscribers).
		Scan(&appliedViews, &appliedLikes, &appliedDislikes, &appliedSubscribers); err != nil {
		if isNoRows(err) {
			return ErrNotFound
		}
		return err
	}

	for _, ev := range []struct {
		kind  string
		delta int64
	}{
		{"views", appliedViews}, {"likes", appliedLikes}, {"dislikes", appliedDislikes}, {"subscribers", appliedSubscribers},
	} {
		if ev.delta == 0 {
			continue
		}
		if _, err := tx.Exec(ctx,
			`INSERT INTO admin_stat_events(channel_id, kind, delta) VALUES ($1, $2, $3)`,
			channelID, ev.kind, ev.delta); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

// ChannelOverride возвращает все 4 поля оверрайдов канала.
type ChannelOverride struct {
	Views       int64
	Likes       int64
	Dislikes    int64
	Subscribers int64
}

func (s *Store) GetOverride(ctx context.Context, channelID string) (ChannelOverride, error) {
	var o ChannelOverride
	err := s.Pool.QueryRow(ctx, `
		SELECT COALESCE(views,0), COALESCE(likes,0), COALESCE(dislikes,0), COALESCE(subscribers,0)
		FROM channel_overrides WHERE channel_id=$1`, channelID).
		Scan(&o.Views, &o.Likes, &o.Dislikes, &o.Subscribers)
	if isNoRows(err) {
		return ChannelOverride{}, nil
	}
	return o, err
}
