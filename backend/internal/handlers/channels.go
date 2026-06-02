package handlers

import (
	"net/http"

	"github.com/go-chi/chi/v5"
)

// GET /api/channels
func (h *Handlers) ListChannels(w http.ResponseWriter, r *http.Request) {
	cs, err := h.Store.ListChannels(r.Context())
	if handleStoreErr(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, cs)
}

// GET /api/channels/{id}
func (h *Handlers) GetChannel(w http.ResponseWriter, r *http.Request) {
	c, err := h.Store.GetChannel(r.Context(), chi.URLParam(r, "id"))
	if handleStoreErr(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, c)
}

// GET /api/channels/by-owner/{userId}
func (h *Handlers) GetChannelByOwner(w http.ResponseWriter, r *http.Request) {
	c, err := h.Store.GetChannelByOwner(r.Context(), chi.URLParam(r, "userId"))
	if handleStoreErr(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, c)
}

// PATCH /api/channels/{id}
func (h *Handlers) UpdateChannel(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req struct {
		Name        *string `json:"name"`
		Description *string `json:"description"`
		AvatarURL   *string `json:"avatarUrl"`
	}
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", err.Error())
		return
	}
	if err := h.Store.UpdateChannelProfile(r.Context(), id, req.Name, req.Description, req.AvatarURL); handleStoreErr(w, err) {
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
