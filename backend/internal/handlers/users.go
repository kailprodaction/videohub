package handlers

import (
	"net/http"

	"github.com/go-chi/chi/v5"
)

// GET /api/users
func (h *Handlers) ListUsers(w http.ResponseWriter, r *http.Request) {
	us, err := h.Store.ListUsers(r.Context())
	if handleStoreErr(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, us)
}

// GET /api/users/me
func (h *Handlers) GetMe(w http.ResponseWriter, r *http.Request) {
	u, err := h.Store.GetUser(r.Context(), h.currentUserID(r))
	if handleStoreErr(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, u)
}

// PATCH /api/users/me
func (h *Handlers) UpdateMe(w http.ResponseWriter, r *http.Request) {
	var req struct {
		DisplayName *string `json:"displayName"`
		Bio         *string `json:"bio"`
		AvatarURL   *string `json:"avatarUrl"`
	}
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", err.Error())
		return
	}
	if err := h.Store.UpdateProfile(r.Context(), h.currentUserID(r), req.DisplayName, req.Bio, req.AvatarURL); handleStoreErr(w, err) {
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// GET /api/users/{id}
func (h *Handlers) GetUser(w http.ResponseWriter, r *http.Request) {
	u, err := h.Store.GetUser(r.Context(), chi.URLParam(r, "id"))
	if handleStoreErr(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, u)
}
