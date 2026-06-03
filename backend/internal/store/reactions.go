package store

import (
	"context"

	"github.com/jackc/pgx/v5"
)

// SetReaction задаёт реакцию пользователя на видео.
// reaction: "like" / "dislike" / "" (убрать).
// Возвращает предыдущую реакцию ("like" / "dislike" / "none") и обновляет счётчики атомарно.
func (s *Store) SetReaction(ctx context.Context, videoID, userID, reaction string) (prev string, err error) {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer tx.Rollback(ctx)

	prev = "none"
	var existing string
	err = tx.QueryRow(ctx, `SELECT reaction FROM video_reactions WHERE user_id=$1 AND video_id=$2`,
		userID, videoID).Scan(&existing)
	if err != nil && err != pgx.ErrNoRows {
		return "", err
	}
	if err == nil {
		if existing == "L" {
			prev = "like"
		} else {
			prev = "dislike"
		}
	}

	dLikes := 0
	dDislikes := 0
	switch prev {
	case "like":
		dLikes--
	case "dislike":
		dDislikes--
	}

	target := reaction
	switch target {
	case "like":
		dLikes++
	case "dislike":
		dDislikes++
	case "":
		target = ""
	default:
		target = ""
	}

	if target == "" {
		if _, err := tx.Exec(ctx,
			`DELETE FROM video_reactions WHERE user_id=$1 AND video_id=$2`,
			userID, videoID); err != nil {
			return "", err
		}
	} else {
		ch := "L"
		if target == "dislike" {
			ch = "D"
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO video_reactions(user_id, video_id, reaction)
			VALUES ($1, $2, $3)
			ON CONFLICT (user_id, video_id) DO UPDATE
				SET reaction=EXCLUDED.reaction, updated_at=NOW()`,
			userID, videoID, ch); err != nil {
			return "", err
		}
	}

	newR := "none"
	if target != "" {
		newR = target
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO reaction_events(user_id, video_id, new_reaction, prev_reaction)
		VALUES ($1, $2, $3, $4)`, userID, videoID, newR, prev); err != nil {
		return "", err
	}

	if dLikes != 0 || dDislikes != 0 {
		if _, err := tx.Exec(ctx,
			`UPDATE videos SET
				likes_count = GREATEST(likes_count + $2, 0),
				dislikes_count = GREATEST(dislikes_count + $3, 0)
			WHERE id=$1`,
			videoID, dLikes, dDislikes); err != nil {
			return "", err
		}
	}

	return prev, tx.Commit(ctx)
}

func (s *Store) GetReaction(ctx context.Context, videoID, userID string) (string, error) {
	var ch string
	err := s.Pool.QueryRow(ctx,
		`SELECT reaction FROM video_reactions WHERE user_id=$1 AND video_id=$2`,
		userID, videoID).Scan(&ch)
	if err == pgx.ErrNoRows {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	if ch == "L" {
		return "like", nil
	}
	return "dislike", nil
}
