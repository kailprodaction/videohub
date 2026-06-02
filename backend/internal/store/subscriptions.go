package store

import (
	"context"

	"videohub/internal/models"
)

func (s *Store) ListSubscriptions(ctx context.Context, subscriberID string) ([]models.Subscription, error) {
	rows, err := s.Pool.Query(ctx, `
		SELECT id, subscriber_id, channel_id, created_at
		FROM subscriptions WHERE subscriber_id=$1 ORDER BY created_at DESC`, subscriberID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]models.Subscription, 0)
	for rows.Next() {
		var sub models.Subscription
		if err := rows.Scan(&sub.ID, &sub.SubscriberID, &sub.ChannelID, &sub.SubscribedAt); err != nil {
			return nil, err
		}
		out = append(out, sub)
	}
	return out, rows.Err()
}

func (s *Store) IsSubscribed(ctx context.Context, subscriberID, channelID string) (bool, error) {
	var exists bool
	err := s.Pool.QueryRow(ctx, `
		SELECT EXISTS (SELECT 1 FROM subscriptions WHERE subscriber_id=$1 AND channel_id=$2)`,
		subscriberID, channelID).Scan(&exists)
	return exists, err
}

// Subscribe / Unsubscribe атомарно поддерживают subscribers_count и журнал событий.
func (s *Store) Subscribe(ctx context.Context, subscriberID, channelID string) error {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	res, err := tx.Exec(ctx, `
		INSERT INTO subscriptions(subscriber_id, channel_id) VALUES ($1, $2)
		ON CONFLICT DO NOTHING`,
		subscriberID, channelID)
	if err != nil {
		return err
	}
	if res.RowsAffected() == 0 {
		return tx.Commit(ctx)
	}
	if _, err := tx.Exec(ctx,
		`UPDATE channels SET subscribers_count = subscribers_count + 1 WHERE id=$1`,
		channelID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx,
		`INSERT INTO subscription_events(subscriber_id, channel_id, action) VALUES ($1, $2, 'subscribe')`,
		subscriberID, channelID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *Store) Unsubscribe(ctx context.Context, subscriberID, channelID string) error {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	res, err := tx.Exec(ctx,
		`DELETE FROM subscriptions WHERE subscriber_id=$1 AND channel_id=$2`,
		subscriberID, channelID)
	if err != nil {
		return err
	}
	if res.RowsAffected() == 0 {
		return tx.Commit(ctx)
	}
	if _, err := tx.Exec(ctx,
		`UPDATE channels SET subscribers_count = GREATEST(subscribers_count - 1, 0) WHERE id=$1`,
		channelID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx,
		`INSERT INTO subscription_events(subscriber_id, channel_id, action) VALUES ($1, $2, 'unsubscribe')`,
		subscriberID, channelID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
