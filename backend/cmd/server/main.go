// videohub backend entrypoint.
//
// 1) Загружает .env (опционально).
// 2) Подключается к Postgres.
// 3) Применяет миграции из ./migrations.
// 4) При пустой БД (или RESEED_ON_START=true) наполняет seed-данные.
// 5) Поднимает HTTP-сервер chi с CORS и статическими /uploads.
package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/joho/godotenv"

	"videohub/internal/config"
	"videohub/internal/db"
	"videohub/internal/handlers"
	"videohub/internal/seed"
	"videohub/internal/server"
	"videohub/internal/store"
)

func main() {
	_ = godotenv.Load()
	cfg := config.Load()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	pool, err := db.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("connect db: %v", err)
	}
	defer pool.Close()

	if cfg.ReseedOnStart {
		log.Println("RESEED_ON_START=true → drop and recreate schema")
		if err := db.DropAll(ctx, pool); err != nil {
			log.Fatalf("drop schema: %v", err)
		}
	}

	log.Println("applying migrations...")
	if err := db.Migrate(ctx, pool, "./migrations"); err != nil {
		log.Fatalf("migrate: %v", err)
	}

	log.Println("seeding (if empty)...")
	if err := seed.Run(ctx, pool, cfg.DefaultUserID); err != nil {
		log.Fatalf("seed: %v", err)
	}

	s := store.New(pool)
	h := handlers.New(s, cfg)
	router := server.NewRouter(h, cfg)

	srv := &http.Server{
		Addr:              cfg.HTTPAddr,
		Handler:           router,
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		log.Printf("videohub backend listening on %s", cfg.HTTPAddr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop
	log.Println("shutting down...")
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()
	_ = srv.Shutdown(shutdownCtx)
}
