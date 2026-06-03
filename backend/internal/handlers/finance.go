package handlers

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	authpkg "videohub/internal/auth"
	"videohub/internal/store"
)

// =====================================================================
// Премиум
// =====================================================================

// POST /api/premium/buy — демо-покупка премиума текущим пользователем.
func (h *Handlers) BuyPremium(w http.ResponseWriter, r *http.Request) {
	uid := authpkg.UserID(r)
	user, tx, err := h.Store.BuyPremium(r.Context(), uid)
	if handleStoreErr(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"user":        user,
		"transaction": tx,
		"message":     "Премиум активирован",
	})
}

// PATCH /api/admin/users/{id}/premium  { "active": true|false, "days": 30 }
//   - active=true → продлевает на days дней с текущего момента (или с текущего конца, если уже был)
//   - active=false → отзывает премиум (premium_until = NULL)
func (h *Handlers) AdminSetPremium(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req struct {
		Active bool `json:"active"`
		Days   int  `json:"days"`
	}
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", err.Error())
		return
	}
	var until *time.Time
	if req.Active {
		days := req.Days
		if days <= 0 {
			days = 30
		}
		t := time.Now().Add(time.Duration(days) * 24 * time.Hour)
		until = &t
	}
	user, err := h.Store.SetPremium(r.Context(), id, until)
	if handleStoreErr(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, user)
}

// GET /api/admin/users/premium — список премиум-пользователей.
func (h *Handlers) AdminListPremium(w http.ResponseWriter, r *http.Request) {
	users, err := h.Store.ListPremiumUsers(r.Context())
	if handleStoreErr(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, users)
}

// =====================================================================
// Транзакции
// =====================================================================

// GET /api/transactions/me — мои транзакции + транзакции моего канала.
func (h *Handlers) MyTransactions(w http.ResponseWriter, r *http.Request) {
	uid := authpkg.UserID(r)
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	list, err := h.Store.ListTransactionsForUser(r.Context(), uid, limit)
	if handleStoreErr(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, list)
}

// GET /api/admin/transactions
func (h *Handlers) AdminListTransactions(w http.ResponseWriter, r *http.Request) {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	list, err := h.Store.ListAllTransactions(r.Context(), limit)
	if handleStoreErr(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, list)
}

// =====================================================================
// Канал: баланс и вывод
// =====================================================================

// GET /api/channels/me — мой канал (с балансом).
func (h *Handlers) MyChannel(w http.ResponseWriter, r *http.Request) {
	c, err := h.Store.GetChannelByOwner(r.Context(), authpkg.UserID(r))
	if handleStoreErr(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, c)
}

// POST /api/channels/me/payout { amount, cardNumber }
//   - cardNumber — полный номер карты, в БД сохраняем только последние 4 цифры
//   - amount: целое число тенге, > 0, <= balance
func (h *Handlers) PayoutMyChannel(w http.ResponseWriter, r *http.Request) {
	uid := authpkg.UserID(r)
	var req struct {
		Amount     int64  `json:"amount"`
		CardNumber string `json:"cardNumber"`
	}
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", err.Error())
		return
	}
	if req.Amount <= 0 {
		writeError(w, http.StatusBadRequest, "validation", "amount must be positive")
		return
	}
	digits := stripNonDigits(req.CardNumber)
	if len(digits) < 12 || len(digits) > 19 {
		writeError(w, http.StatusBadRequest, "validation", "card number length must be 12..19 digits")
		return
	}
	last4 := digits[len(digits)-4:]

	channel, err := h.Store.GetChannelByOwner(r.Context(), uid)
	if handleStoreErr(w, err) {
		return
	}

	tx, err := h.Store.PayoutChannel(r.Context(), channel.ID, uid, req.Amount, last4)
	if errors.Is(err, store.ErrInsufficientFunds) {
		writeError(w, http.StatusBadRequest, "insufficient_funds",
			"баланс канала меньше запрошенной суммы")
		return
	}
	if handleStoreErr(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"transaction": tx,
		"message":     "Деньги отправлены на карту •••• " + last4,
	})
}

// PATCH /api/admin/channels/{id}/balance  { amount, comment }
//   - amount > 0 — начисление; < 0 — списание; пишет ADMIN_ADJUSTMENT.
func (h *Handlers) AdminAdjustBalance(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req struct {
		Amount  int64  `json:"amount"`
		Comment string `json:"comment"`
	}
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", err.Error())
		return
	}
	if req.Amount == 0 {
		writeError(w, http.StatusBadRequest, "validation", "amount must be non-zero")
		return
	}
	tx, err := h.Store.AdminAdjustBalance(r.Context(), id, req.Amount, req.Comment)
	if handleStoreErr(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, tx)
}

func stripNonDigits(s string) string {
	var b strings.Builder
	for _, r := range s {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	return b.String()
}
