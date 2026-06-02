package handlers

import (
	"net/http"

	"github.com/go-chi/chi/v5"
)

// GET /api/subscriptions
func (h *Handlers) ListSubscriptions(w http.ResponseWriter, r *http.Request) {
	subs, err := h.Store.ListSubscriptions(r.Context(), h.currentUserID(r))
	if handleStoreErr(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, subs)
}

// GET /api/channels/{id}/subscribed
func (h *Handlers) IsSubscribed(w http.ResponseWriter, r *http.Request) {
	subscribed, err := h.Store.IsSubscribed(r.Context(), h.currentUserID(r), chi.URLParam(r, "id"))
	if handleStoreErr(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"subscribed": subscribed})
}

// POST /api/channels/{id}/subscribe
func (h *Handlers) Subscribe(w http.ResponseWriter, r *http.Request) {
	if err := h.Store.Subscribe(r.Context(), h.currentUserID(r), chi.URLParam(r, "id")); handleStoreErr(w, err) {
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// DELETE /api/channels/{id}/subscribe
func (h *Handlers) Unsubscribe(w http.ResponseWriter, r *http.Request) {
	if err := h.Store.Unsubscribe(r.Context(), h.currentUserID(r), chi.URLParam(r, "id")); handleStoreErr(w, err) {
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
