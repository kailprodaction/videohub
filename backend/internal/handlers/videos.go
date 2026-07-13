package handlers

import (
	"context"
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"

	authpkg "videohub/internal/auth"
	"videohub/internal/ml"
	"videohub/internal/models"
	"videohub/internal/store"
)

// GET /api/videos?q=&channelId=&limit=&category=
func (h *Handlers) ListVideos(w http.ResponseWriter, r *http.Request) {
	params := store.ListVideosParams{
		Query:      r.URL.Query().Get("q"),
		ChannelID:  r.URL.Query().Get("channelId"),
		Category:   r.URL.Query().Get("category"),
		OnlyPublic: r.URL.Query().Get("onlyPublic") == "true",
	}
	if l, err := strconv.Atoi(r.URL.Query().Get("limit")); err == nil {
		params.Limit = l
	}
	videos, err := h.Store.ListVideos(r.Context(), params)
	if handleStoreErr(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, videos)
}

// GET /api/videos/{id}
func (h *Handlers) GetVideo(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	v, err := h.Store.GetVideo(r.Context(), id)
	if handleStoreErr(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, v)
}

// DELETE /api/videos/{id}
func (h *Handlers) DeleteVideo(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.Store.DeleteVideo(r.Context(), id); handleStoreErr(w, err) {
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// createVideoReq — JSON-форма создания (для случая, когда файлы уже загружены).
type createVideoReq struct {
	ChannelID    string   `json:"channelId"`
	Title        string   `json:"title"`
	Description  string   `json:"description"`
	ThumbnailURL string   `json:"thumbnailUrl"`
	VideoURL     string   `json:"videoUrl"`
	DurationSec  int      `json:"durationSec"`
	Category     string   `json:"category"`
	Visibility   string   `json:"visibility"`
	Tags         []string `json:"tags"`
}

// POST /api/videos — создаёт видео (ссылки на файлы предполагаются уже загруженными).
func (h *Handlers) CreateVideo(w http.ResponseWriter, r *http.Request) {
	if authpkg.Role(r) == "admin" {
		writeError(w, http.StatusForbidden, "forbidden", "admins can create ads only, not channel videos")
		return
	}

	var req createVideoReq
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", "invalid json: "+err.Error())
		return
	}
	if req.Title == "" || req.ChannelID == "" {
		writeError(w, http.StatusBadRequest, "validation", "title and channelId are required")
		return
	}
	if req.Visibility == "" {
		req.Visibility = "public"
	}
	if req.Category == "" {
		req.Category = "other"
	}
	if req.Tags == nil {
		req.Tags = []string{}
	}
	req.Tags = normalizeTags(req.Tags)

	// --- ML-модерация до публикации (см. internal/ml) ---
	// Классификатор оценивает риск по метаданным; решение выставляет
	// стартовый moderation_status: approved / pending / blocked.
	verdict := ml.Classify(ml.ModerationInput{
		Title:       req.Title,
		Description: req.Description,
		Tags:        req.Tags,
		DurationSec: req.DurationSec,
		LinkCount:   countLinks(req.Description),
	})
	status := ml.StatusForDecision(verdict.Decision)

	v, err := h.Store.CreateVideo(r.Context(), models.Video{
		ChannelID:        req.ChannelID,
		Title:            req.Title,
		Description:      req.Description,
		ThumbnailURL:     req.ThumbnailURL,
		VideoURL:         req.VideoURL,
		DurationSec:      req.DurationSec,
		Category:         req.Category,
		Visibility:       req.Visibility,
		Tags:             req.Tags,
		ModerationStatus: status,
	})
	if handleStoreErr(w, err) {
		return
	}

	// Сохраняем прогон модерации (audit trail + очередь модератора).
	if err := h.Store.SaveModerationResult(r.Context(), toModerationRecord(v.ID, verdict, status)); err != nil {
		log.Printf("save moderation result for %s: %v", v.ID, err)
	}

	writeJSON(w, http.StatusCreated, map[string]any{
		"video":      v,
		"moderation": verdict,
	})
}

// POST /api/videos/{id}/views — засчитывает уникальный просмотр.
// Если пользователь уже смотрел это видео — счётчик не увеличивается.
// Для анонимных запросов просмотр не засчитывается вовсе
// (берём id строго из JWT, без fallback на DEFAULT_USER_ID).
func (h *Handlers) RegisterView(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	uid := authpkg.UserID(r)
	counted, err := h.Store.RegisterView(r.Context(), id, uid)
	if handleStoreErr(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"counted": counted})
}

// POST /api/videos/{id}/reaction { "reaction": "like" | "dislike" | "" }
func (h *Handlers) SetReaction(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req struct {
		Reaction string `json:"reaction"`
	}
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", err.Error())
		return
	}
	if req.Reaction != "" && req.Reaction != "like" && req.Reaction != "dislike" {
		writeError(w, http.StatusBadRequest, "validation", "reaction must be 'like', 'dislike' or empty")
		return
	}
	prev, err := h.Store.SetReaction(r.Context(), id, h.currentUserID(r), req.Reaction)
	if handleStoreErr(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"previous": prev, "current": fallback(req.Reaction, "none")})
}

// GET /api/videos/{id}/reaction — текущая реакция пользователя.
func (h *Handlers) GetReaction(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	cur, err := h.Store.GetReaction(r.Context(), id, h.currentUserID(r))
	if handleStoreErr(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"reaction": fallback(cur, "")})
}

// GET /api/videos/recommended — главная лента (гибридный рекомендатель).
func (h *Handlers) Recommended(w http.ResponseWriter, r *http.Request) {
	limit := 24
	if l, err := strconv.Atoi(r.URL.Query().Get("limit")); err == nil && l > 0 {
		limit = l
	}
	category := r.URL.Query().Get("category")
	pool, err := h.Store.ListVideos(r.Context(), store.ListVideosParams{
		OnlyPublic: true, ApprovedOnly: true, Limit: 200, OrderBy: "rating",
	})
	if handleStoreErr(w, err) {
		return
	}
	sig := h.recommendSignals(r.Context(), authpkg.UserID(r), "")
	writeJSON(w, http.StatusOK, ml.RecommendFeed(pool, sig, category, limit))
}

// GET /api/videos/{id}/recommendations — блок «похожие» рядом с плеером.
func (h *Handlers) Recommendations(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	current, err := h.Store.GetVideo(r.Context(), id)
	if handleStoreErr(w, err) {
		return
	}
	pool, err := h.Store.ListVideos(r.Context(), store.ListVideosParams{
		OnlyPublic: true, ApprovedOnly: true, ExcludeID: id, Limit: 200, OrderBy: "rating",
	})
	if handleStoreErr(w, err) {
		return
	}
	limit := 12
	if l, err := strconv.Atoi(r.URL.Query().Get("limit")); err == nil && l > 0 {
		limit = l
	}
	sig := h.recommendSignals(r.Context(), authpkg.UserID(r), id)
	writeJSON(w, http.StatusOK, ml.RecommendRelated(pool, *current, sig, limit))
}

// recommendSignals собирает пользовательские и коллаборативные сигналы для
// рекомендатора. Ошибки отдельных запросов не валят выдачу — деградируем до
// популярности (сигналы просто остаются пустыми).
func (h *Handlers) recommendSignals(ctx context.Context, userID, seedVideoID string) ml.Signals {
	var sig ml.Signals
	sig.User.UserID = userID
	if userID != "" {
		if aff, err := h.Store.UserAffinity(ctx, userID); err == nil {
			sig.User.CategoryAffinity = aff
		}
		if subs, err := h.Store.SubscribedChannelIDs(ctx, userID); err == nil {
			sig.User.SubscribedChannels = subs
		}
		if watched, err := h.Store.WatchedVideoIDs(ctx, userID); err == nil {
			sig.User.WatchedVideoIDs = watched
		}
	}
	if seedVideoID != "" {
		if co, err := h.Store.CoWatch(ctx, seedVideoID, 200); err == nil {
			sig.CoWatch = co
		}
	}
	return sig
}

// countLinks грубо считает число URL в тексте (сигнал спама для модерации).
func countLinks(s string) int {
	return strings.Count(strings.ToLower(s), "http")
}

func fallback(s, def string) string {
	if s == "" {
		return def
	}
	return s
}

func normalizeTags(tags []string) []string {
	out := make([]string, 0, len(tags))
	seen := make(map[string]struct{}, len(tags))
	for _, tag := range tags {
		tag = strings.TrimSpace(strings.TrimLeft(tag, "#"))
		if tag == "" {
			continue
		}
		key := strings.ToLower(tag)
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		out = append(out, tag)
	}
	return out
}
