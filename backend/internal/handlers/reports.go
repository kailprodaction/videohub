package handlers

import (
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"

	authpkg "videohub/internal/auth"
	"videohub/internal/models"
	"videohub/internal/store"
)

var validReasons = map[string]bool{
	"spam": true, "nudity": true, "violence": true, "copyright": true,
	"hate": true, "misinformation": true, "other": true,
}
var validTargets = map[string]bool{"video": true, "comment": true, "channel": true}

// POST /api/reports  { targetType, targetId, reason, details }
// Любой залогиненный пользователь может пожаловаться на контент.
func (h *Handlers) CreateReport(w http.ResponseWriter, r *http.Request) {
	var req struct {
		TargetType string `json:"targetType"`
		TargetID   string `json:"targetId"`
		Reason     string `json:"reason"`
		Details    string `json:"details"`
	}
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", err.Error())
		return
	}
	if !validTargets[req.TargetType] {
		writeError(w, http.StatusBadRequest, "validation", "invalid targetType")
		return
	}
	if !validReasons[req.Reason] {
		writeError(w, http.StatusBadRequest, "validation", "invalid reason")
		return
	}
	if req.TargetID == "" {
		writeError(w, http.StatusBadRequest, "validation", "targetId is required")
		return
	}
	if len(req.Details) > 1000 {
		req.Details = req.Details[:1000]
	}

	uid := authpkg.UserID(r)
	var reporter *string
	if uid != "" {
		reporter = &uid
	}
	rep, err := h.Store.CreateReport(r.Context(), models.Report{
		TargetType: req.TargetType,
		TargetID:   req.TargetID,
		ReporterID: reporter,
		Reason:     req.Reason,
		Details:    req.Details,
	})
	if errors.Is(err, store.ErrDuplicateReport) {
		writeError(w, http.StatusConflict, "duplicate", "вы уже жаловались на этот контент")
		return
	}
	if handleStoreErr(w, err) {
		return
	}
	writeJSON(w, http.StatusCreated, rep)
}

// GET /api/admin/reports?status=open
func (h *Handlers) AdminListReports(w http.ResponseWriter, r *http.Request) {
	status := r.URL.Query().Get("status")
	reports, err := h.Store.ListReports(r.Context(), status, 300)
	if handleStoreErr(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, reports)
}

// POST /api/admin/reports/{id}/resolve  { status, resolution }
// status: reviewing | resolved | dismissed
func (h *Handlers) AdminResolveReport(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req struct {
		Status     string `json:"status"`
		Resolution string `json:"resolution"`
	}
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", err.Error())
		return
	}
	switch req.Status {
	case "reviewing", "resolved", "dismissed":
	default:
		writeError(w, http.StatusBadRequest, "validation", "status must be reviewing|resolved|dismissed")
		return
	}
	if err := h.Store.ResolveReport(r.Context(), id, req.Status, req.Resolution, authpkg.UserID(r)); handleStoreErr(w, err) {
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
