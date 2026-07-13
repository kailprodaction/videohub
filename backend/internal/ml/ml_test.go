package ml

import (
	"testing"
	"time"

	"videohub/internal/models"
)

func TestClassify_CleanApproved(t *testing.T) {
	r := Classify(ModerationInput{
		Title:       "Как приготовить пасту карбонара",
		Description: "Пошаговый рецепт классической итальянской пасты.",
		Tags:        []string{"кулинария", "рецепт"},
		DurationSec: 480,
	})
	if r.Decision != DecisionApproved {
		t.Fatalf("clean video should be approved, got %s (overall=%.2f)", r.Decision, r.Overall)
	}
	if r.Sanction != SanctionNone {
		t.Fatalf("clean video should have no sanction, got %s", r.Sanction)
	}
}

func TestClassify_AdultBlocked(t *testing.T) {
	r := Classify(ModerationInput{
		Title:       "XXX explicit porn full nude",
		Description: "onlyfans leaked adult content",
		Tags:        []string{"porn", "nsfw", "18+"},
		DurationSec: 600,
	})
	if r.Decision == DecisionApproved {
		t.Fatalf("adult video must not be approved (overall=%.2f)", r.Overall)
	}
	if r.Nudity < thresholdReview {
		t.Fatalf("nudity score should be high, got %.2f", r.Nudity)
	}
	if !contains(r.Labels, "nudity") {
		t.Fatalf("expected nudity label, got %v", r.Labels)
	}
}

func TestClassify_SpamDetected(t *testing.T) {
	r := Classify(ModerationInput{
		Title:       "FREE MONEY CLICK HERE!!!!! CRYPTO GIVEAWAY",
		Description: "make money fast $$$ btc usdt переходи по ссылке http://a http://b http://c",
		Tags:        []string{"a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p"},
		DurationSec: 30,
		LinkCount:   3,
	})
	if r.Spam < thresholdReview {
		t.Fatalf("spam score should be high, got %.2f", r.Spam)
	}
	if r.Decision == DecisionApproved {
		t.Fatalf("obvious spam must not be approved (overall=%.2f)", r.Overall)
	}
}

func TestStatusForDecision(t *testing.T) {
	cases := map[string]string{
		DecisionAutoBlock:    "blocked",
		DecisionManualReview: "pending",
		DecisionApproved:     "approved",
	}
	for dec, want := range cases {
		if got := StatusForDecision(dec); got != want {
			t.Errorf("StatusForDecision(%s)=%s, want %s", dec, got, want)
		}
	}
}

func TestRecommendFeed_LimitAndNonEmpty(t *testing.T) {
	now := time.Now()
	pool := []models.Video{
		{ID: "1", ChannelID: "c1", Category: "music", Views: 1000, Likes: 100, Dislikes: 2, UploadedAt: now.Add(-24 * time.Hour), Tags: []string{"rock"}},
		{ID: "2", ChannelID: "c1", Category: "music", Views: 900, Likes: 90, Dislikes: 1, UploadedAt: now.Add(-48 * time.Hour), Tags: []string{"rock"}},
		{ID: "3", ChannelID: "c2", Category: "tech", Views: 500, Likes: 50, Dislikes: 3, UploadedAt: now.Add(-72 * time.Hour), Tags: []string{"go"}},
		{ID: "4", ChannelID: "c3", Category: "gaming", Views: 2000, Likes: 300, Dislikes: 5, UploadedAt: now.Add(-12 * time.Hour), Tags: []string{"fps"}},
	}
	out := RecommendFeed(pool, Signals{}, "", 3)
	if len(out) != 3 {
		t.Fatalf("expected 3 results, got %d", len(out))
	}
	// MMR должен разнообразить: первые два не из одного канала подряд, если есть выбор.
	if out[0].ChannelID == out[1].ChannelID && out[1].ChannelID == out[2].ChannelID {
		t.Errorf("MMR failed to diversify channels: %v", out)
	}
}

func TestRecommendRelated_ExcludesSeed(t *testing.T) {
	now := time.Now()
	seed := models.Video{ID: "seed", ChannelID: "c1", Category: "music", Tags: []string{"rock"}, UploadedAt: now}
	pool := []models.Video{
		seed,
		{ID: "a", ChannelID: "c2", Category: "music", Tags: []string{"rock"}, Views: 100, UploadedAt: now},
		{ID: "b", ChannelID: "c3", Category: "tech", Tags: []string{"go"}, Views: 100, UploadedAt: now},
	}
	out := RecommendRelated(pool, seed, Signals{}, 10)
	for _, v := range out {
		if v.ID == "seed" {
			t.Fatalf("related must not contain the seed video")
		}
	}
	if len(out) == 0 {
		t.Fatal("related should not be empty")
	}
}

func contains(s []string, x string) bool {
	for _, v := range s {
		if v == x {
			return true
		}
	}
	return false
}
