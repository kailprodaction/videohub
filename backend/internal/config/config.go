package config

import (
	"os"
	"strconv"
	"strings"
)

type Config struct {
	HTTPAddr        string
	DatabaseURL     string
	UploadsDir      string
	PublicBaseURL   string
	CORSOrigins     []string
	MaxVideoBytes   int64
	MaxImageBytes   int64
	DefaultUserID   string
	ReseedOnStart   bool

	JWTSecret       []byte
	JWTTTLHours     int
	AdminUsername   string
	AdminPassword   string
	AuthCodeTTLMin  int
	// AuthExposeCode = true означает, что backend будет возвращать сгенерированный код
	// прямо в ответе API (для демонстрации без SMTP). В проде должно быть false.
	AuthExposeCode  bool
}

func Load() Config {
	return Config{
		HTTPAddr:      getEnv("HTTP_ADDR", ":8080"),
		DatabaseURL:   getEnv("DATABASE_URL", "postgres://videohub:videohub@localhost:5432/videohub?sslmode=disable"),
		UploadsDir:    getEnv("UPLOADS_DIR", "./uploads"),
		PublicBaseURL: strings.TrimRight(getEnv("PUBLIC_BASE_URL", "http://localhost:8080"), "/"),
		CORSOrigins:   splitCSV(getEnv("CORS_ORIGINS", "http://localhost:5173")),
		MaxVideoBytes: getEnvInt64("MAX_VIDEO_BYTES", 500*1024*1024),
		MaxImageBytes: getEnvInt64("MAX_IMAGE_BYTES", 10*1024*1024),
		DefaultUserID: getEnv("DEFAULT_USER_ID", "11111111-1111-1111-1111-111111111111"),
		ReseedOnStart: getEnvBool("RESEED_ON_START", false),

		JWTSecret:      []byte(getEnv("JWT_SECRET", "videohub-dev-secret-change-me")),
		JWTTTLHours:    int(getEnvInt64("JWT_TTL_HOURS", 24*7)),
		AdminUsername:  getEnv("ADMIN_USERNAME", "admin"),
		AdminPassword:  getEnv("ADMIN_PASSWORD", "admin1"),
		AuthCodeTTLMin: int(getEnvInt64("AUTH_CODE_TTL_MIN", 10)),
		AuthExposeCode: getEnvBool("AUTH_EXPOSE_CODE", true),
	}
}

func getEnv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func getEnvInt64(key string, def int64) int64 {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil {
			return n
		}
	}
	return def
}

func getEnvBool(key string, def bool) bool {
	if v := os.Getenv(key); v != "" {
		if b, err := strconv.ParseBool(v); err == nil {
			return b
		}
	}
	return def
}

func splitCSV(s string) []string {
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}
