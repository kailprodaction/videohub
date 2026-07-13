package ml

import (
	"math"
	"regexp"
	"strings"
)

// Решения автоматической модерации (пороги ниже).
const (
	DecisionApproved     = "approved"      // score < 0.40 — публикуем
	DecisionManualReview = "manual_review" // 0.40..0.80 — в очередь модератору
	DecisionAutoBlock    = "auto_block"    // score >= 0.80 — блок сразу
)

// Санкции DMN-матрицы «тип нарушения → санкция».
const (
	SanctionNone       = "none"
	SanctionWarning    = "warning"
	SanctionDemonetize = "demonetize"
	SanctionHide       = "hide"
	SanctionBan        = "ban"
)

const (
	thresholdBlock  = 0.80
	thresholdReview = 0.40
)

// ModerationInput — то, что классификатор может «увидеть» без пиксельного
// анализа: метаданные ролика. В проде здесь бы стояли выходы CV-моделей и
// аудио-fingerprint (ACRCloud); тут — прозрачная лексико-эвристическая модель
// с той же схемой скоров и решений.
type ModerationInput struct {
	Title       string
	Description string
	Tags        []string
	DurationSec int
	LinkCount   int // сколько ссылок в описании (заполняет вызывающий)
}

// ModerationResult — покомпонентные вероятности, итог и решение.
type ModerationResult struct {
	Nudity    float64  `json:"nudity"`
	Copyright float64  `json:"copyright"`
	Spam      float64  `json:"spam"`
	Violence  float64  `json:"violence"`
	Overall   float64  `json:"overall"`
	Decision  string   `json:"decision"`
	Labels    []string `json:"labels"`   // какие метки сработали (объяснимость)
	Sanction  string   `json:"sanction"` // из DMN-матрицы
}

// Classify прогоняет вход через четыре под-классификатора и агрегирует.
func Classify(in ModerationInput) ModerationResult {
	text := strings.ToLower(in.Title + " \n " + in.Description + " \n " + strings.Join(in.Tags, " "))

	nudity := lexScore(text, nudityLexicon)
	violence := lexScore(text, violenceLexicon)
	copyright := copyrightScore(text, in.DurationSec)
	spam := spamScore(in, text)

	// Итог — не среднее, а «сильнейшее нарушение решает»: одного тяжёлого
	// достаточно. Плюс небольшой вклад остальных, чтобы «на грани по всем»
	// тоже поднималось.
	scores := map[string]float64{
		"nudity": nudity, "violence": violence, "copyright": copyright, "spam": spam,
	}
	overall := aggregate(scores)

	res := ModerationResult{
		Nudity: round3(nudity), Copyright: round3(copyright),
		Spam: round3(spam), Violence: round3(violence),
		Overall: round3(overall),
	}
	res.Labels = triggeredLabels(scores)
	res.Decision = decide(overall)
	res.Sanction = sanction(scores, res.Decision)
	return res
}

// decide применяет пороги.
func decide(overall float64) string {
	switch {
	case overall >= thresholdBlock:
		return DecisionAutoBlock
	case overall >= thresholdReview:
		return DecisionManualReview
	default:
		return DecisionApproved
	}
}

// StatusForDecision переводит решение автоматики в moderation_status видео.
func StatusForDecision(decision string) string {
	switch decision {
	case DecisionAutoBlock:
		return "blocked"
	case DecisionManualReview:
		return "pending"
	default:
		return "approved"
	}
}

// aggregate: max + затухающий вклад остальных нарушений.
func aggregate(scores map[string]float64) float64 {
	var mx, rest float64
	for _, s := range scores {
		if s > mx {
			rest += mx // предыдущий максимум уходит в «остальные»
			mx = s
		} else {
			rest += s
		}
	}
	return clamp01(mx + 0.12*rest)
}

func triggeredLabels(scores map[string]float64) []string {
	var out []string
	for _, k := range []string{"nudity", "violence", "copyright", "spam"} {
		if scores[k] >= thresholdReview {
			out = append(out, k)
		}
	}
	if out == nil {
		out = []string{}
	}
	return out
}

// -------- DMN: матрица «тип нарушения → санкция» --------
//
// Раньше это был бы switch из десятков кейсов. Здесь — таблица: для каждой
// метки задаётся, какая санкция назначается на каком уровне риска. Итоговая
// санкция — самая строгая из сработавших.
type dmnRule struct {
	label      string
	warnAt     float64 // предупреждение
	demoteAt   float64 // демонетизация
	hideAt     float64 // скрытие
	banAt      float64 // бан автора
	banEnabled bool    // за spam баним, за copyright — нет (только скрытие/страйк)
}

var dmnTable = []dmnRule{
	{"nudity", 0.40, 0.55, 0.70, 0.85, true},
	{"violence", 0.45, 0.60, 0.75, 0.90, true},
	{"copyright", 0.40, 0.50, 0.70, 0.95, false},
	{"spam", 0.45, 0.60, 0.80, 0.90, true},
}

var sanctionRank = map[string]int{
	SanctionNone: 0, SanctionWarning: 1, SanctionDemonetize: 2, SanctionHide: 3, SanctionBan: 4,
}

func sanction(scores map[string]float64, decision string) string {
	if decision == DecisionApproved {
		return SanctionNone
	}
	worst := SanctionNone
	for _, r := range dmnTable {
		s := scores[r.label]
		cur := SanctionNone
		switch {
		case r.banEnabled && s >= r.banAt:
			cur = SanctionBan
		case s >= r.hideAt:
			cur = SanctionHide
		case s >= r.demoteAt:
			cur = SanctionDemonetize
		case s >= r.warnAt:
			cur = SanctionWarning
		}
		if sanctionRank[cur] > sanctionRank[worst] {
			worst = cur
		}
	}
	return worst
}

// -------- под-классификаторы --------

// lexScore — сумма весов сработавших фраз, сжатая логистикой в 0..1.
func lexScore(text string, lex map[string]float64) float64 {
	var sum float64
	for phrase, w := range lex {
		if strings.Contains(text, phrase) {
			sum += w
		}
	}
	return logistic(sum)
}

// copyrightScore — лексикон правообладателей + эвристика «полный фильм/эпизод».
func copyrightScore(text string, durationSec int) float64 {
	sum := 0.0
	for phrase, w := range copyrightLexicon {
		if strings.Contains(text, phrase) {
			sum += w
		}
	}
	// Длинный ролик с «full movie/episode» в описании — типичный пират.
	if durationSec > 40*60 && (strings.Contains(text, "full movie") ||
		strings.Contains(text, "полный фильм") || strings.Contains(text, "full episode")) {
		sum += 2.0
	}
	return logistic(sum)
}

// RE2 (пакет regexp) не поддерживает обратные ссылки, поэтому повторы символов
// ищем вручную (hasRepeatedRun), а regexp оставляем только для денежных паттернов.
var moneyRe = regexp.MustCompile(`\$\d|\d+\s?\$|₸|btc|usdt`)

// hasRepeatedRun — есть ли в строке серия из n+1 одинаковых символов подряд (ааааа, !!!!!).
func hasRepeatedRun(s string, n int) bool {
	run := 1
	var prev rune
	for i, r := range s {
		if i > 0 && r == prev {
			run++
			if run > n {
				return true
			}
		} else {
			run = 1
		}
		prev = r
	}
	return false
}

// spamScore — эвристики: капс, повторы, ссылки, «раздача призов», много тегов.
func spamScore(in ModerationInput, text string) float64 {
	sum := 0.0
	for phrase, w := range spamLexicon {
		if strings.Contains(text, phrase) {
			sum += w
		}
	}
	if capsRatio(in.Title) > 0.6 && len(in.Title) > 10 {
		sum += 1.2
	}
	if hasRepeatedRun(text, 4) {
		sum += 0.8
	}
	if in.LinkCount >= 3 {
		sum += float64(in.LinkCount) * 0.5
	}
	if len(in.Tags) > 15 {
		sum += 1.0 // теговый спам
	}
	if moneyRe.MatchString(text) {
		sum += 0.7
	}
	return logistic(sum)
}

// logistic превращает накопленный «вес улик» в вероятность.
// Сдвиг 2.2 подобран так, что одиночного слабого совпадения мало для review,
// а двух весомых — достаточно.
func logistic(x float64) float64 {
	return 1.0 / (1.0 + math.Exp(-(x - 2.2)))
}

func capsRatio(s string) float64 {
	var letters, upper int
	for _, r := range s {
		if r >= 'A' && r <= 'Z' || r >= 'А' && r <= 'Я' {
			upper++
			letters++
		} else if r >= 'a' && r <= 'z' || r >= 'а' && r <= 'я' {
			letters++
		}
	}
	if letters == 0 {
		return 0
	}
	return float64(upper) / float64(letters)
}

func round3(x float64) float64 { return math.Round(x*1000) / 1000 }

// -------- Лексиконы (демо-словари; в проде — обученные модели) --------

var nudityLexicon = map[string]float64{
	"xxx": 2.4, "porn": 2.6, "nsfw": 1.6, "nude": 1.8, "onlyfans": 2.0,
	"18+": 1.2, "explicit": 1.4, "порно": 2.6, "секс": 1.4, "эротик": 1.8,
	"обнаж": 1.6, "adult content": 1.8,
}

var violenceLexicon = map[string]float64{
	"gore": 2.0, "beheading": 2.8, "graphic violence": 2.2, "murder": 1.4,
	"terror": 1.6, "shooting": 1.2, "убийств": 1.6, "расчлен": 2.6,
	"жесток": 1.2, "насил": 1.8, "теракт": 2.0,
}

var copyrightLexicon = map[string]float64{
	"leaked": 1.4, "official music video": 0.8, "©": 1.0, "all rights reserved": 1.2,
	"rip from": 1.6, "camrip": 2.2, "ts screener": 2.0, "пиратк": 2.0,
	"без цензуры官": 1.0, "с торрента": 1.6, "рип с": 1.4,
}

var spamLexicon = map[string]float64{
	"free money": 2.0, "click here": 1.4, "subscribe now": 0.8, "giveaway": 1.0,
	"promo code": 1.0, "make money fast": 2.2, "crypto giveaway": 2.6,
	"бесплатно раздаю": 2.0, "заработок без вложений": 2.4, "переходи по ссылке": 1.4,
	"розыгрыш призов": 1.0, "промокод": 0.8, "инвестиции": 0.6,
}
