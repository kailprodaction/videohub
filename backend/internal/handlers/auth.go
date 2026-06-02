package handlers

import (
	"errors"
	"log"
	"net/http"
	"regexp"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"

	authpkg "videohub/internal/auth"
	"videohub/internal/models"
	"videohub/internal/store"
)

// loginRegexp — допустимый формат логина: латиница/цифры/_/-, 3..30 символов.
var loginRegexp = regexp.MustCompile(`^[a-zA-Z0-9_-]{3,30}$`)

// =====================================================================
// Регистрация: email → код → ввод кода → создаётся пользователь с
// заранее введёнными login + password.
// =====================================================================

// POST /api/auth/register { email, login, displayName, password }
func (h *Handlers) AuthRegister(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email       string `json:"email"`
		Login       string `json:"login"`
		DisplayName string `json:"displayName"`
		Password    string `json:"password"`
	}
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", err.Error())
		return
	}
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	req.Login = strings.TrimSpace(req.Login)
	req.DisplayName = strings.TrimSpace(req.DisplayName)

	if !validEmail(req.Email) {
		writeError(w, http.StatusBadRequest, "validation", "invalid email")
		return
	}
	if !loginRegexp.MatchString(req.Login) {
		writeError(w, http.StatusBadRequest, "validation",
			"login must be 3..30 chars: latin letters, digits, '_' or '-'")
		return
	}
	if len(req.DisplayName) < 1 || len(req.DisplayName) > 50 {
		writeError(w, http.StatusBadRequest, "validation", "displayName must be 1..50")
		return
	}
	if len(req.Password) < 6 || len(req.Password) > 100 {
		writeError(w, http.StatusBadRequest, "validation", "password must be 6..100")
		return
	}

	if _, err := h.Store.GetUserByEmail(r.Context(), req.Email); err == nil {
		writeError(w, http.StatusConflict, "exists", "user with this email already exists")
		return
	} else if !errors.Is(err, store.ErrNotFound) && handleStoreErr(w, err) {
		return
	}
	taken, err := h.Store.IsLoginTaken(r.Context(), req.Login)
	if handleStoreErr(w, err) {
		return
	}
	if taken {
		writeError(w, http.StatusConflict, "login_taken", "this login is already taken")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "failed to hash password")
		return
	}

	code := authpkg.GenerateCode()
	ttl := time.Duration(h.Cfg.AuthCodeTTLMin) * time.Minute
	if err := h.Store.CreateAuthCode(r.Context(), store.CreateAuthCodeParams{
		Email:        req.Email,
		Code:         code,
		Kind:         "register",
		DisplayName:  req.DisplayName,
		Login:        req.Login,
		PasswordHash: string(hash),
		TTL:          ttl,
	}); handleStoreErr(w, err) {
		return
	}
	log.Printf("auth: register code for %s = %s (login=%s, expires in %s)",
		req.Email, code, req.Login, ttl)

	resp := map[string]any{
		"email":     req.Email,
		"login":     req.Login,
		"expiresAt": time.Now().Add(ttl),
	}
	if h.Cfg.AuthExposeCode {
		resp["devCode"] = code
	}
	writeJSON(w, http.StatusOK, resp)
}

// POST /api/auth/register/verify { email, code }
func (h *Handlers) AuthRegisterVerify(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email string `json:"email"`
		Code  string `json:"code"`
	}
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", err.Error())
		return
	}
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	req.Code = strings.TrimSpace(req.Code)

	ac, err := h.Store.ConsumeAuthCode(r.Context(), req.Email, req.Code, "register")
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusBadRequest, "invalid_code", "code is invalid or expired")
		return
	}
	if handleStoreErr(w, err) {
		return
	}

	user, err := h.Store.CreateUserWithChannel(r.Context(), store.CreateUserParams{
		Login:        ac.Login,
		DisplayName:  ac.DisplayName,
		Email:        ac.Email,
		PasswordHash: ac.PasswordHash,
	})
	if handleStoreErr(w, err) {
		return
	}
	h.respondWithToken(w, user)
}

// =====================================================================
// Вход — единственный путь: логин + пароль (для всех, включая админа).
// =====================================================================

// POST /api/auth/login { login, password }
func (h *Handlers) AuthLogin(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Login    string `json:"login"`
		Password string `json:"password"`
	}
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", err.Error())
		return
	}
	req.Login = strings.TrimSpace(req.Login)

	user, hash, err := h.Store.GetUserByUsername(r.Context(), req.Login)
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusUnauthorized, "invalid_credentials", "wrong login or password")
		return
	}
	if handleStoreErr(w, err) {
		return
	}
	if user.Blocked {
		writeError(w, http.StatusForbidden, "blocked", "this account is blocked")
		return
	}
	if hash == "" || bcrypt.CompareHashAndPassword([]byte(hash), []byte(req.Password)) != nil {
		writeError(w, http.StatusUnauthorized, "invalid_credentials", "wrong login or password")
		return
	}
	h.respondWithToken(w, user)
}

// GET /api/auth/me — возвращает текущего пользователя по JWT (или 401).
func (h *Handlers) AuthMe(w http.ResponseWriter, r *http.Request) {
	id := authpkg.UserID(r)
	if id == "" {
		writeError(w, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}
	u, err := h.Store.GetUser(r.Context(), id)
	if handleStoreErr(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, u)
}

// ----- helpers -----

func (h *Handlers) respondWithToken(w http.ResponseWriter, user *models.User) {
	tok, err := authpkg.Issue(h.Cfg.JWTSecret, user.ID, user.Role,
		time.Duration(h.Cfg.JWTTTLHours)*time.Hour)
	if err != nil {
		log.Printf("issue token: %v", err)
		writeError(w, http.StatusInternalServerError, "internal", "failed to issue token")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"token": tok,
		"user":  user,
	})
}

func validEmail(s string) bool {
	at := strings.IndexByte(s, '@')
	if at <= 0 || at == len(s)-1 {
		return false
	}
	if strings.Contains(s, " ") {
		return false
	}
	dot := strings.LastIndexByte(s, '.')
	return dot > at+1 && dot < len(s)-1
}
