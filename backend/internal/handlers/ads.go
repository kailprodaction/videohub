package handlers

import (
	"errors"
	"net/http"
	"net/url"
	"path/filepath"
	"strings"

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
	if !h.isUploadedAdURL(r, req.VideoURL) {
		writeError(w, http.StatusBadRequest, "validation", "ad video must be uploaded as a file")
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
	if req.VideoURL != nil && !h.isUploadedAdURL(r, *req.VideoURL) {
		writeError(w, http.StatusBadRequest, "validation", "ad video must be uploaded as a file")
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

func (h *Handlers) isUploadedAdURL(r *http.Request, raw string) bool {
	uploadPath, ok := extractAdUploadPath(raw)
	if !ok {
		return false
	}
	if _, err := h.Store.GetUploadFile(r.Context(), uploadPath); err != nil {
		return false
	}
	return true
}

func extractAdUploadPath(raw string) (string, bool) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", false
	}

	path := raw
	if parsed, err := url.Parse(raw); err == nil && parsed.Path != "" {
		path = parsed.Path
	}

	const prefix = "/uploads/ADS/"
	if !strings.HasPrefix(path, prefix) {
		return "", false
	}

	ext := strings.ToLower(filepath.Ext(path))
	if ext != ".mp4" && ext != ".webm" {
		return "", false
	}

	name := strings.TrimPrefix(path, prefix)
	if name == "" || strings.Contains(name, "/") {
		return "", false
	}

	return "ADS/" + name, true
}

// DELETE /api/admin/ads/{id}
func (h *Handlers) AdminDeleteAd(w http.ResponseWriter, r *http.Request) {
	if err := h.Store.DeleteAd(r.Context(), chi.URLParam(r, "id")); handleStoreErr(w, err) {
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
