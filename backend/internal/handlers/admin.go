package handlers

import (
	"net/http"

	"github.com/go-chi/chi/v5"
)

// POST /api/admin/channels/{id}/stats
//
// Тело: { "viewsDelta": 100, "likesDelta": 5, "dislikesDelta": -1, "subscribersDelta": 20 }
// Любые поля могут быть опущены — будут трактоваться как 0.
func (h *Handlers) AdminAdjustStats(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req struct {
		ViewsDelta       int64 `json:"viewsDelta"`
		LikesDelta       int64 `json:"likesDelta"`
		DislikesDelta    int64 `json:"dislikesDelta"`
		SubscribersDelta int64 `json:"subscribersDelta"`
	}
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", err.Error())
		return
	}
	if err := h.Store.AdminAdjustStats(r.Context(), id,
		req.ViewsDelta, req.LikesDelta, req.DislikesDelta, req.SubscribersDelta); handleStoreErr(w, err) {
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// POST /api/admin/videos/{id}/stats
//
// Тело: { "viewsDelta": 100, "likesDelta": 5, "dislikesDelta": -1 }
// Точечно меняет счётчики конкретного видео. Счётчики не уходят ниже 0.
func (h *Handlers) AdminAdjustVideoStats(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req struct {
		ViewsDelta    int64 `json:"viewsDelta"`
		LikesDelta    int64 `json:"likesDelta"`
		DislikesDelta int64 `json:"dislikesDelta"`
	}
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", err.Error())
		return
	}
	if err := h.Store.AdminAdjustVideoStats(r.Context(), id,
		req.ViewsDelta, req.LikesDelta, req.DislikesDelta); handleStoreErr(w, err) {
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// POST /api/admin/users/{id}/block  { "blocked": true|false }
func (h *Handlers) AdminBlockUser(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req struct {
		Blocked bool `json:"blocked"`
	}
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", err.Error())
		return
	}
	if err := h.Store.SetBlocked(r.Context(), id, req.Blocked); handleStoreErr(w, err) {
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// GET /api/admin/comments
func (h *Handlers) AdminListComments(w http.ResponseWriter, r *http.Request) {
	cs, err := h.Store.ListAllComments(r.Context())
	if handleStoreErr(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, cs)
}
