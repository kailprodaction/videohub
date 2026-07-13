package ml

import (
	"math"
	"strings"

	"videohub/internal/models"
)

// sparseVec — разреженный вектор признаков (feature → вес). Так дешевле, чем
// плотный массив: у видео обычно 3–8 ненулевых признаков из сотен возможных.
type sparseVec map[string]float64

// featurize строит вектор признаков видео из категории, тегов и длительности.
// Категория и теги идут с префиксами, чтобы тег "music" и категория "music"
// не схлопывались в одно измерение.
func featurize(v models.Video) sparseVec {
	vec := make(sparseVec, len(v.Tags)+2)
	if v.Category != "" {
		vec["cat:"+strings.ToLower(v.Category)] = 1.6 // категория весит больше тега
	}
	for _, t := range v.Tags {
		t = strings.ToLower(strings.TrimSpace(strings.TrimLeft(t, "#")))
		if t == "" {
			continue
		}
		vec["tag:"+t] += 1.0
	}
	// Токены заголовка — слабый сигнал тематической близости.
	for _, tok := range tokenize(v.Title) {
		vec["tok:"+tok] += 0.35
	}
	vec["dur:"+durationBucket(v.DurationSec)] = 0.5
	return vec
}

// cosine — косинусная близость двух разреженных векторов в диапазоне [0, 1]
// (веса неотрицательны, поэтому отрицательных значений не бывает).
func cosine(a, b sparseVec) float64 {
	if len(a) == 0 || len(b) == 0 {
		return 0
	}
	// Итерируем по меньшему вектору — меньше обращений к map.
	small, large := a, b
	if len(b) < len(a) {
		small, large = b, a
	}
	var dot float64
	for k, va := range small {
		if vb, ok := large[k]; ok {
			dot += va * vb
		}
	}
	if dot == 0 {
		return 0
	}
	return dot / (norm(a) * norm(b))
}

func norm(v sparseVec) float64 {
	var s float64
	for _, x := range v {
		s += x * x
	}
	return math.Sqrt(s)
}

// durationBucket группирует длительность: короткие/средние/длинные видео
// смотрят в разных контекстах, это полезный признак близости.
func durationBucket(sec int) string {
	switch {
	case sec <= 0:
		return "unknown"
	case sec < 90:
		return "short"
	case sec < 20*60:
		return "mid"
	default:
		return "long"
	}
}

// tokenize — грубая нормализация заголовка в токены длиннее 2 символов.
func tokenize(s string) []string {
	fields := strings.FieldsFunc(strings.ToLower(s), func(r rune) bool {
		return !(r >= 'a' && r <= 'z' || r >= 'а' && r <= 'я' || r >= '0' && r <= '9')
	})
	out := make([]string, 0, len(fields))
	for _, f := range fields {
		if len([]rune(f)) > 2 && !stopWords[f] {
			out = append(out, f)
		}
	}
	return out
}

// Небольшой стоп-лист, чтобы служебные слова не создавали ложной близости.
var stopWords = map[string]bool{
	"the": true, "and": true, "for": true, "you": true, "how": true,
	"что": true, "как": true, "это": true, "для": true, "the ": true,
}
