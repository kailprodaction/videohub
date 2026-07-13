// Package ml — рекомендательный движок и ML-модерация контента VideoHub.
//
// Рекомендации строятся не «как попало», а гибридом из пяти методов, каждый
// отвечает за свой аспект, а итог — их взвешенная комбинация с последующим
// разнообразием (MMR):
//
//  1. Popularity   — вовлечённость + свежесть (trending-сигнал).
//  2. Quality      — доля лайков через нижнюю границу Уилсона (не обманывается
//                    видео с 1 лайком и 0 дизлайков).
//  3. Content-based— косинусная близость векторов признаков (категория/теги/
//                    длительность/токены заголовка) к затравке или к профилю.
//  4. Collaborative— item-item ко-просмотры: «те, кто смотрел это, смотрели и…».
//  5. Personalized — аффинность пользователя к категориям + буст подписок.
//
// Финальный список пересортировывается MMR: релевантность минус похожесть на
// уже выбранное — так лента не забивается одним каналом/одной темой.
package ml

import (
	"math"
	"sort"
	"time"

	"videohub/internal/models"
)

// UserContext — то, что известно о зрителе. Для анонима все поля пустые,
// тогда персонализация вырождается в популярность + качество.
type UserContext struct {
	UserID             string
	CategoryAffinity   map[string]float64 // категория → сколько смотрел (сырые счётчики)
	SubscribedChannels map[string]bool    // каналы, на которые подписан
	WatchedVideoIDs    map[string]bool    // что уже видел — понижаем в выдаче
}

// Signals — внешние (из БД) сигналы для одного запроса рекомендаций.
type Signals struct {
	User    UserContext
	CoWatch map[string]int64 // videoID → сила ко-просмотра с затравкой (для related)
}

// weights задаёт вклад каждого метода. Разные для главной ленты и для «похожих».
type weights struct {
	popularity    float64
	quality       float64
	content       float64
	collaborative float64
	personal      float64
}

var feedWeights = weights{popularity: 0.30, quality: 0.15, content: 0.15, collaborative: 0.05, personal: 0.35}
var relatedWeights = weights{popularity: 0.15, quality: 0.10, content: 0.35, collaborative: 0.30, personal: 0.10}

// RecommendFeed — главная лента. seedCategory опционален (чип категории на главной).
func RecommendFeed(pool []models.Video, sig Signals, seedCategory string, limit int) []models.Video {
	return rank(pool, nil, seedCategory, sig, feedWeights, limit)
}

// RecommendRelated — блок «рекомендации» рядом с плеером: затравка — текущее видео.
func RecommendRelated(pool []models.Video, seed models.Video, sig Signals, limit int) []models.Video {
	return rank(pool, &seed, seed.Category, sig, relatedWeights, limit)
}

type scored struct {
	v    models.Video
	rel  float64   // итоговая релевантность 0..1
	feat sparseVec // вектор признаков (кэш для MMR)
}

func rank(pool []models.Video, seed *models.Video, seedCategory string, sig Signals, w weights, limit int) []models.Video {
	if len(pool) == 0 {
		return []models.Video{}
	}
	now := time.Now()

	var seedVec sparseVec
	if seed != nil {
		seedVec = featurize(*seed)
	}
	affinity := normalizeAffinity(sig.User.CategoryAffinity)
	maxCo := maxCoWatch(sig.CoWatch)

	// 1. Считаем компонентные скоры и линейную комбинацию.
	items := make([]scored, 0, len(pool))
	for _, v := range pool {
		if seed != nil && v.ID == seed.ID {
			continue
		}
		fv := featurize(v)

		pop := popularityScore(v, now)
		qual := wilsonScore(v.Likes, v.Dislikes)

		content := 0.0
		if seedVec != nil {
			content = cosine(seedVec, fv)
		} else if seedCategory != "" && v.Category == seedCategory {
			content = 1.0
		}

		collab := 0.0
		if maxCo > 0 {
			collab = float64(sig.CoWatch[v.ID]) / maxCo
		}

		personal := personalScore(v, affinity, sig.User.SubscribedChannels)

		rel := w.popularity*pop + w.quality*qual + w.content*content +
			w.collaborative*collab + w.personal*personal

		// Уже просмотренное сильно понижаем, но не выкидываем совсем.
		if sig.User.WatchedVideoIDs[v.ID] {
			rel *= 0.15
		}
		items = append(items, scored{v: v, rel: rel, feat: fv})
	}

	sort.SliceStable(items, func(i, j int) bool { return items[i].rel > items[j].rel })

	// 2. MMR-переранжирование ради разнообразия ленты.
	return mmr(items, limit)
}

// popularityScore — вовлечённость с бонусом за свежесть, сжатая в 0..1.
func popularityScore(v models.Video, now time.Time) float64 {
	raw := float64(v.Views)*1.0 + float64(v.Likes)*5.0 - float64(v.Dislikes)*3.0
	if raw < 0 {
		raw = 0
	}
	// log-сжатие: разница между 1k и 10k просмотров не должна давить всё остальное.
	base := math.Log1p(raw) / math.Log1p(1_000_000) // ~1.0 при миллионе очков
	fresh := freshness(v.UploadedAt, now)
	s := 0.75*base + 0.25*fresh
	return clamp01(s)
}

// freshness — 1.0 для только что залитого, плавно к 0 за 30 дней.
func freshness(uploaded, now time.Time) float64 {
	days := now.Sub(uploaded).Hours() / 24.0
	if days <= 0 {
		return 1
	}
	const halfLife = 7.0 // через неделю свежесть падает вдвое
	return math.Exp(-days / halfLife * math.Ln2)
}

// wilsonScore — нижняя граница 95% доверительного интервала доли лайков.
// Штрафует малую выборку: 3 лайка/0 дизлайков хуже, чем 900/100.
func wilsonScore(likes, dislikes int64) float64 {
	n := float64(likes + dislikes)
	if n == 0 {
		return 0.5 // нет данных — нейтрально
	}
	phat := float64(likes) / n
	const z = 1.96
	denom := 1 + z*z/n
	centre := phat + z*z/(2*n)
	margin := z * math.Sqrt((phat*(1-phat)+z*z/(4*n))/n)
	return clamp01((centre - margin) / denom)
}

// personalScore — аффинность к категории видео + буст, если подписан на канал.
func personalScore(v models.Video, affinity map[string]float64, subs map[string]bool) float64 {
	s := affinity[v.Category] // уже нормировано в 0..1
	if subs[v.ChannelID] {
		s = math.Max(s, 0.6) + 0.4
	}
	return clamp01(s)
}

// mmr — Maximal Marginal Relevance: жадно набираем список, каждый раз выбирая
// кандидата с лучшим балансом релевантности и НЕпохожести на уже выбранных.
func mmr(items []scored, limit int) []models.Video {
	const lambda = 0.72 // 0.72 релевантность / 0.28 разнообразие
	if limit <= 0 || limit > len(items) {
		limit = len(items)
	}
	selected := make([]scored, 0, limit)
	used := make([]bool, len(items))

	for len(selected) < limit {
		best, bestScore := -1, math.Inf(-1)
		for i, it := range items {
			if used[i] {
				continue
			}
			var maxSim float64
			for _, s := range selected {
				sim := similarity(it, s)
				if sim > maxSim {
					maxSim = sim
				}
			}
			score := lambda*it.rel - (1-lambda)*maxSim
			if score > bestScore {
				best, bestScore = i, score
			}
		}
		if best < 0 {
			break
		}
		used[best] = true
		selected = append(selected, items[best])
	}

	out := make([]models.Video, len(selected))
	for i, s := range selected {
		out[i] = s.v
	}
	return out
}

// similarity для MMR: тот же канал — сильное сходство, плюс косинус признаков.
func similarity(a, b scored) float64 {
	sim := cosine(a.feat, b.feat)
	if a.v.ChannelID == b.v.ChannelID {
		sim = math.Max(sim, 0.85)
	}
	return sim
}

// normalizeAffinity приводит сырые счётчики просмотров по категориям к 0..1
// делением на максимум (относительный интерес пользователя).
func normalizeAffinity(raw map[string]float64) map[string]float64 {
	if len(raw) == 0 {
		return raw
	}
	var mx float64
	for _, c := range raw {
		if c > mx {
			mx = c
		}
	}
	if mx == 0 {
		return raw
	}
	out := make(map[string]float64, len(raw))
	for k, c := range raw {
		out[k] = c / mx
	}
	return out
}

func maxCoWatch(m map[string]int64) float64 {
	var mx int64
	for _, c := range m {
		if c > mx {
			mx = c
		}
	}
	return float64(mx)
}

func clamp01(x float64) float64 {
	if x < 0 {
		return 0
	}
	if x > 1 {
		return 1
	}
	return x
}
