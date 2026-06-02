// Package recommend ранжирует видео по простой формуле:
//
//	rating = views * 1 + likes * 5 - dislikes * 3 + freshnessBonus
//
// Чем свежее видео — тем больше бонус. Если задана подсказка по категории,
// видео из этой категории получают дополнительный множитель.
package recommend

import (
	"sort"
	"time"

	"videohub/internal/models"
)

// Rank сортирует слайс видео по рейтингу in-place и возвращает первые limit.
// hintCategory — категория видео, к которому ищутся рекомендации; пусто = главная.
func Rank(videos []models.Video, hintCategory string, limit int) []models.Video {
	now := time.Now()
	scored := make([]scored, len(videos))
	for i, v := range videos {
		scored[i] = scored[i].withScore(v, hintCategory, now)
	}
	sort.SliceStable(scored, func(i, j int) bool {
		return scored[i].score > scored[j].score
	})
	out := make([]models.Video, 0, min(limit, len(scored)))
	for i := 0; i < len(scored) && (limit <= 0 || i < limit); i++ {
		out = append(out, scored[i].video)
	}
	return out
}

type scored struct {
	video models.Video
	score float64
}

func (s scored) withScore(v models.Video, hint string, now time.Time) scored {
	score := float64(v.Views)*1.0 + float64(v.Likes)*5.0 - float64(v.Dislikes)*3.0
	score += freshnessBonus(v.UploadedAt, now)
	if hint != "" && v.Category == hint {
		score *= 1.4 // приоритет той же категории
	}
	return scored{video: v, score: score}
}

// freshnessBonus = +50 за каждый день моложе 14 дней, монотонно убывает.
func freshnessBonus(uploaded, now time.Time) float64 {
	days := now.Sub(uploaded).Hours() / 24.0
	const window = 14.0
	if days >= window {
		return 0
	}
	return (window - days) * 50.0
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
