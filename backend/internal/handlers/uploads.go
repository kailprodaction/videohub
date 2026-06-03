package handlers

import (
	"errors"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/google/uuid"
)

// allowedVideoExt = mp4, webm — кладём в uploads/MP4.
// allowedImageExt = png, jpg/jpeg, webp — кладём в uploads/PNG.
var (
	allowedVideoExt = map[string]bool{".mp4": true, ".webm": true}
	allowedImageExt = map[string]bool{".png": true, ".jpg": true, ".jpeg": true, ".webp": true}
)

// POST /api/upload/video  (multipart/form-data, поле "file")
func (h *Handlers) UploadVideo(w http.ResponseWriter, r *http.Request) {
	url, err := h.saveUpload(r, "MP4", h.Cfg.MaxVideoBytes, allowedVideoExt)
	if err != nil {
		writeUploadErr(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{"url": url})
}

// POST /api/upload/ad (multipart/form-data, поле "file") — рекламные ролики.
// Тот же формат и лимит, что у обычных видео, но кладутся в uploads/ADS.
func (h *Handlers) UploadAd(w http.ResponseWriter, r *http.Request) {
	url, err := h.saveUpload(r, "ADS", h.Cfg.MaxVideoBytes, allowedVideoExt)
	if err != nil {
		writeUploadErr(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{"url": url})
}

// POST /api/upload/image  (multipart/form-data, поле "file")
func (h *Handlers) UploadImage(w http.ResponseWriter, r *http.Request) {
	url, err := h.saveUpload(r, "PNG", h.Cfg.MaxImageBytes, allowedImageExt)
	if err != nil {
		writeUploadErr(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{"url": url})
}

func (h *Handlers) saveUpload(r *http.Request, subdir string, maxBytes int64, allowed map[string]bool) (string, error) {
	// 1) Ограничим размер запроса на уровне reader — Multipart парсер не превысит лимит.
	r.Body = http.MaxBytesReader(nil, r.Body, maxBytes+1024)

	if err := r.ParseMultipartForm(32 << 20); err != nil {
		return "", uploadError{status: http.StatusBadRequest, msg: "invalid multipart: " + err.Error()}
	}
	defer func() {
		if r.MultipartForm != nil {
			_ = r.MultipartForm.RemoveAll()
		}
	}()

	file, header, err := r.FormFile("file")
	if err != nil {
		return "", uploadError{status: http.StatusBadRequest, msg: "form field 'file' is required"}
	}
	defer file.Close()

	if header.Size > maxBytes {
		return "", uploadError{status: http.StatusRequestEntityTooLarge, msg: "file too large"}
	}

	ext := strings.ToLower(filepath.Ext(header.Filename))
	if !allowed[ext] {
		return "", uploadError{status: http.StatusUnsupportedMediaType, msg: "unsupported file extension: " + ext}
	}

	// 2) Создадим целевую папку, если её ещё нет.
	dirAbs, err := filepath.Abs(filepath.Join(h.Cfg.UploadsDir, subdir))
	if err != nil {
		return "", err
	}
	if err := os.MkdirAll(dirAbs, 0o755); err != nil {
		return "", err
	}

	// 3) Сгенерируем уникальное имя.
	fileName := uuid.NewString() + ext
	full := filepath.Join(dirAbs, fileName)

	dst, err := os.Create(full)
	if err != nil {
		return "", err
	}
	defer dst.Close()

	written, err := io.Copy(dst, file)
	if err != nil {
		_ = os.Remove(full)
		return "", err
	}
	if written > maxBytes {
		_ = os.Remove(full)
		return "", uploadError{status: http.StatusRequestEntityTooLarge, msg: "file too large"}
	}

	publicURL := strings.TrimRight(h.Cfg.PublicBaseURL, "/") + "/uploads/" + subdir + "/" + fileName
	return publicURL, nil
}

type uploadError struct {
	status int
	msg    string
}

func (e uploadError) Error() string { return e.msg }

func writeUploadErr(w http.ResponseWriter, err error) {
	var ue uploadError
	if errors.As(err, &ue) {
		writeError(w, ue.status, "upload", ue.msg)
		return
	}
	writeError(w, http.StatusInternalServerError, "upload", err.Error())
}
