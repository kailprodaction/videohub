// Package security собирает «защитный слой» приложения в одном месте:
// заголовки безопасности, ограничение частоты запросов (rate limiting) и
// вспомогательные функции валидации. Подключается в server/router.go.
//
// Цель — вынести Trust & Safety инфраструктуру из бизнес-хендлеров, чтобы
// политика безопасности была видимой, тестируемой и менялась в одном файле.
package security

import (
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

// SecureHeaders выставляет заголовки, отсекающие целый класс атак:
// MIME-sniffing, clickjacking, утечку referrer, а также базовый CSP.
func SecureHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("X-Frame-Options", "SAMEORIGIN")
		h.Set("Referrer-Policy", "strict-origin-when-cross-origin")
		h.Set("X-XSS-Protection", "0") // современные браузеры полагаются на CSP
		h.Set("Permissions-Policy", "geolocation=(), microphone=(), camera=()")
		// Разрешаем медиа/картинки с того же origin + data:, запрещаем object/frame.
		h.Set("Content-Security-Policy",
			"default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; "+
				"object-src 'none'; frame-ancestors 'self'; base-uri 'self'")
		// HSTS имеет смысл только под HTTPS — включаем, если запрос уже защищён.
		if r.TLS != nil || strings.EqualFold(r.Header.Get("X-Forwarded-Proto"), "https") {
			h.Set("Strict-Transport-Security", "max-age=63072000; includeSubDomains")
		}
		next.ServeHTTP(w, r)
	})
}

// -------- Rate limiting (token bucket на IP) --------

type bucket struct {
	tokens   float64
	lastSeen time.Time
}

// RateLimiter — потокобезопасный лимитер: rps токенов в секунду, ёмкость burst.
type RateLimiter struct {
	mu      sync.Mutex
	buckets map[string]*bucket
	rps     float64
	burst   float64
}

// NewRateLimiter создаёт лимитер и фоновую уборку неактивных бакетов.
func NewRateLimiter(rps, burst float64) *RateLimiter {
	rl := &RateLimiter{buckets: make(map[string]*bucket), rps: rps, burst: burst}
	go rl.cleanupLoop()
	return rl
}

// allow расходует один токен для ключа. false — лимит превышен.
func (rl *RateLimiter) allow(key string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	now := time.Now()
	b, ok := rl.buckets[key]
	if !ok {
		rl.buckets[key] = &bucket{tokens: rl.burst - 1, lastSeen: now}
		return true
	}
	// Пополняем пропорционально прошедшему времени.
	b.tokens += now.Sub(b.lastSeen).Seconds() * rl.rps
	if b.tokens > rl.burst {
		b.tokens = rl.burst
	}
	b.lastSeen = now
	if b.tokens < 1 {
		return false
	}
	b.tokens--
	return true
}

// Middleware — chi-совместимая обёртка. Ключ — клиентский IP.
func (rl *RateLimiter) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !rl.allow(clientIP(r)) {
			w.Header().Set("Retry-After", "1")
			http.Error(w, `{"error":{"code":"rate_limited","message":"too many requests"}}`,
				http.StatusTooManyRequests)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (rl *RateLimiter) cleanupLoop() {
	t := time.NewTicker(5 * time.Minute)
	for range t.C {
		cutoff := time.Now().Add(-10 * time.Minute)
		rl.mu.Lock()
		for k, b := range rl.buckets {
			if b.lastSeen.Before(cutoff) {
				delete(rl.buckets, k)
			}
		}
		rl.mu.Unlock()
	}
}

// clientIP извлекает IP: сперва X-Forwarded-For (за прокси/nginx), затем RemoteAddr.
func clientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		if i := strings.IndexByte(xff, ','); i >= 0 {
			return strings.TrimSpace(xff[:i])
		}
		return strings.TrimSpace(xff)
	}
	if host, _, err := net.SplitHostPort(r.RemoteAddr); err == nil {
		return host
	}
	return r.RemoteAddr
}
