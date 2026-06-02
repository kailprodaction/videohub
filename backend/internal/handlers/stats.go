package handlers

import (
	"net/http"

	"github.com/go-chi/chi/v5"
)

// GET /api/channels/{id}/stats
func (h *Handlers) ChannelStats(w http.ResponseWriter, r *http.Request) {
	stats, err := h.Store.ChannelStats(r.Context(), chi.URLParam(r, "id"))
	if handleStoreErr(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, stats)
}

// GET /api/admin/stats
func (h *Handlers) PlatformStats(w http.ResponseWriter, r *http.Request) {
	stats, err := h.Store.PlatformStats(r.Context())
	if handleStoreErr(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, stats)
}
