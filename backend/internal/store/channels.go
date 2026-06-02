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
	c.subscribers_count + COALESCE(o.subscribers, 0) AS subscribers_count,
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

// AdminAdjustStats применяет дельты к channel_overrides и пишет журнал.
func (s *Store) AdminAdjustStats(ctx context.Context, channelID string, views, likes, dislikes, subscribers int64) error {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `
		INSERT INTO channel_overrides(channel_id, views, likes, dislikes, subscribers)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (channel_id) DO UPDATE SET
			views       = channel_overrides.views       + EXCLUDED.views,
			likes       = channel_overrides.likes       + EXCLUDED.likes,
			dislikes    = channel_overrides.dislikes    + EXCLUDED.dislikes,
			subscribers = channel_overrides.subscribers + EXCLUDED.subscribers,
			updated_at  = NOW()`,
		channelID, views, likes, dislikes, subscribers); err != nil {
		return err
	}

	for _, ev := range []struct {
		kind  string
		delta int64
	}{
		{"views", views}, {"likes", likes}, {"dislikes", dislikes}, {"subscribers", subscribers},
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
