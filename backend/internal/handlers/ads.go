package handlers

import (
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"

	"videohub/internal/store"
)

// GET /api/ads/active — отдаёт случайную активную рекламу или 204.
// Frontend проигрывает её перед видео. Если у пользователя premium=true —
// клиент сам этот эндпоинт не зовёт.
func (h *Handlers) ActiveAd(w http.ResponseWriter, r *http.Request) {
	ad, err := h.Store.GetRandomActiveAd(r.Context())
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		handleStoreErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, ad)
}

// GET /api/admin/ads
func (h *Handlers) AdminListAds(w http.ResponseWriter, r *http.Request) {
	ads, err := h.Store.ListAds(r.Context())
	if handleStoreErr(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, ads)
}

// POST /api/admin/ads { title, description, videoUrl, active }
func (h *Handlers) AdminCreateAd(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Title       string `json:"title"`
		Description string `json:"description"`
		VideoURL    string `json:"videoUrl"`
		Active      *bool  `json:"active"`
	}
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", err.Error())
		return
	}
	if req.Title == "" || req.VideoURL == "" {
		writeError(w, http.StatusBadRequest, "validation", "title and videoUrl are required")
		return
	}
	active := true
	if req.Active != nil {
		active = *req.Active
	}
	ad, err := h.Store.CreateAd(r.Context(), store.CreateAdParams{
		Title:       req.Title,
		Description: req.Description,
		VideoURL:    req.VideoURL,
		Active:      active,
	})
	if handleStoreErr(w, err) {
		return
	}
	writeJSON(w, http.StatusCreated, ad)
}

// PATCH /api/admin/ads/{id}
func (h *Handlers) AdminUpdateAd(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req struct {
		Title       *string `json:"title"`
		Description *string `json:"description"`
		VideoURL    *string `json:"videoUrl"`
		Active      *bool   `json:"active"`
	}
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", err.Error())
		return
	}
	if err := h.Store.UpdateAd(r.Context(), id, store.UpdateAdParams{
		Title: req.Title, Description: req.Description,
		VideoURL: req.VideoURL, Active: req.Active,
	}); handleStoreErr(w, err) {
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// DELETE /api/admin/ads/{id}
func (h *Handlers) AdminDeleteAd(w http.ResponseWriter, r *http.Request) {
	if err := h.Store.DeleteAd(r.Context(), chi.URLParam(r, "id")); handleStoreErr(w, err) {
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
