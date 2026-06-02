package db

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Open подключается к Postgres и возвращает пул соединений.
// Делает ping с несколькими ретраями — удобно при поднятии в Docker.
func Open(ctx context.Context, databaseURL string) (*pgxpool.Pool, error) {
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, fmt.Errorf("pgx connect: %w", err)
	}
	var lastErr error
	for i := 0; i < 10; i++ {
		if err := pool.Ping(ctx); err == nil {
			return pool, nil
		} else {
			lastErr = err
		}
		time.Sleep(time.Second)
	}
	return nil, fmt.Errorf("postgres unreachable: %w", lastErr)
}

// Migrate применяет все *.sql файлы из directory в алфавитном порядке.
// Каждый файл выполняется как один батч, чтобы поддерживать несколько statements.
func Migrate(ctx context.Context, pool *pgxpool.Pool, dir string) error {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return fmt.Errorf("read migrations dir %q: %w", dir, err)
	}
	files := make([]string, 0, len(entries))
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(strings.ToLower(e.Name()), ".sql") {
			files = append(files, e.Name())
		}
	}
	sort.Strings(files)

	for _, name := range files {
		raw, err := os.ReadFile(filepath.Join(dir, name))
		if err != nil {
			return fmt.Errorf("read %s: %w", name, err)
		}
		if _, err := pool.Exec(ctx, string(raw)); err != nil {
			return fmt.Errorf("apply %s: %w", name, err)
		}
	}
	return nil
}

// DropAll удаляет все таблицы в схеме public — используется при RESEED_ON_START=true.
func DropAll(ctx context.Context, pool *pgxpool.Pool) error {
	_, err := pool.Exec(ctx, `DROP SCHEMA public CASCADE; CREATE SCHEMA public;`)
	return err
}
