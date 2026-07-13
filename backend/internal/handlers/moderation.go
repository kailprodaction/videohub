package handlers

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	authpkg "videohub/internal/auth"
	"videohub/internal/ml"
	"videohub/internal/models"
)

// toModerationRecord собирает строку moderation_results из вердикта классификатора.
func toModerationRecord(videoID string, v ml.ModerationResult, status string) models.ModerationRecord {
	return models.ModerationRecord{
		VideoID:        videoID,
		NudityScore:    v.Nudity,
		CopyrightScore: v.Copyright,
		SpamScore:      v.Spam,
		ViolenceScore:  v.Violence,
		OverallScore:   v.Overall,
		Decision:       v.Decision,
		Labels:         v.Labels,
		Sanction:       v.Sanction,
		Source:         "ml",
		Status:         status,
	}
}

// GET /api/admin/moderation — очередь модерации (видео не в статусе approved).
func (h *Handlers) AdminModerationQueue(w http.ResponseWriter, r *http.Request) {
	items, err := h.Store.ModerationQueue(r.Context(), 200)
	if handleStoreErr(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, items)
}

// POST /api/admin/videos/{id}/moderation  { status, sanction }
// Ручное решение модератора. status: approved | pending | blocked | shadow.
func (h *Handlers) AdminModerationDecision(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req struct {
		Status   string `json:"status"`
		Sanction string `json:"sanction"`
	}
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", err.Error())
		return
	}
	switch req.Status {
	case "approved", "pending", "blocked", "shadow":
	default:
		writeError(w, http.StatusBadRequest, "validation", "status must be approved|pending|blocked|shadow")
		return
	}
	if req.Sanction == "" {
		req.Sanction = ml.SanctionNone
	}
	if err := h.Store.SetModerationStatus(r.Context(), id, req.Status, req.Sanction, authpkg.UserID(r)); handleStoreErr(w, err) {
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// POST /api/admin/videos/{id}/moderation/rescan — перепрогнать ML-классификатор
// по актуальным метаданным видео (например, после правки описания).
func (h *Handlers) AdminRescanModeration(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	v, err := h.Store.GetVideo(r.Context(), id)
	if handleStoreErr(w, err) {
		return
	}
	verdict := ml.Classify(ml.ModerationInput{
		Title:       v.Title,
		Description: v.Description,
		Tags:        v.Tags,
		DurationSec: v.DurationSec,
		LinkCount:   countLinks(v.Description),
	})
	status := ml.StatusForDecision(verdict.Decision)
	if err := h.Store.SaveModerationResult(r.Context(), toModerationRecord(v.ID, verdict, status)); handleStoreErr(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"status": status, "moderation": verdict})
}
