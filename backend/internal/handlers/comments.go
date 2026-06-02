package handlers

import (
	"net/http"

	"github.com/go-chi/chi/v5"
)

// GET /api/videos/{id}/comments
func (h *Handlers) ListComments(w http.ResponseWriter, r *http.Request) {
	cs, err := h.Store.ListComments(r.Context(), chi.URLParam(r, "id"))
	if handleStoreErr(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, cs)
}

// POST /api/videos/{id}/comments  { "text": "..." }
func (h *Handlers) AddComment(w http.ResponseWriter, r *http.Request) {
	videoID := chi.URLParam(r, "id")
	var req struct {
		Text string `json:"text"`
	}
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", err.Error())
		return
	}
	if len(req.Text) == 0 || len(req.Text) > 500 {
		writeError(w, http.StatusBadRequest, "validation", "text length must be 1..500")
		return
	}
	c, err := h.Store.AddComment(r.Context(), videoID, h.currentUserID(r), req.Text)
	if handleStoreErr(w, err) {
		return
	}
	writeJSON(w, http.StatusCreated, c)
}

// DELETE /api/comments/{id}
func (h *Handlers) DeleteComment(w http.ResponseWriter, r *http.Request) {
	if err := h.Store.DeleteComment(r.Context(), chi.URLParam(r, "id")); handleStoreErr(w, err) {
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
