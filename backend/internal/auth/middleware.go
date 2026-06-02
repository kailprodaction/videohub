package auth

import (
	"context"
	"net/http"
	"strings"
)

type ctxKey int

const (
	userIDKey ctxKey = iota
	roleKey
)

// Middleware парсит JWT из заголовка Authorization (если есть) и кладёт claims в context.
// Не отвергает запрос — для публичных эндпоинтов авторизация необязательна.
// Защита делается через RequireAuth / RequireAdmin.
func Middleware(secret []byte) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if strings.HasPrefix(authHeader, "Bearer ") {
				tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
				if claims, err := Parse(secret, tokenStr); err == nil {
					ctx := context.WithValue(r.Context(), userIDKey, claims.UserID)
					ctx = context.WithValue(ctx, roleKey, claims.Role)
					r = r.WithContext(ctx)
				}
			}
			next.ServeHTTP(w, r)
		})
	}
}

// RequireAuth блокирует запрос, если в контексте нет user_id.
func RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if UserID(r) == "" {
			writeJSONError(w, http.StatusUnauthorized, "unauthorized", "authentication required")
			return
		}
		next.ServeHTTP(w, r)
	})
}

// RequireAdmin блокирует запрос, если роль не admin.
func RequireAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if Role(r) != "admin" {
			writeJSONError(w, http.StatusForbidden, "forbidden", "admin only")
			return
		}
		next.ServeHTTP(w, r)
	})
}

// UserID возвращает id текущего пользователя из контекста или пустую строку.
func UserID(r *http.Request) string {
	v, _ := r.Context().Value(userIDKey).(string)
	return v
}

// Role возвращает роль текущего пользователя или пустую строку.
func Role(r *http.Request) string {
	v, _ := r.Context().Value(roleKey).(string)
	return v
}

func writeJSONError(w http.ResponseWriter, status int, code, msg string) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_, _ = w.Write([]byte(`{"error":{"code":"` + code + `","message":"` + msg + `"}}`))
}
