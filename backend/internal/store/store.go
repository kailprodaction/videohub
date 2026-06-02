package store

import (
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Store держит пул и предоставляет методы доступа к данным.
// Все методы принимают context.Context, чтобы поддерживать таймауты HTTP-запросов.
type Store struct {
	Pool *pgxpool.Pool
}

func New(pool *pgxpool.Pool) *Store {
	return &Store{Pool: pool}
}

// ErrNotFound возвращается репозиториями, когда строка не найдена.
var ErrNotFound = errors.New("not found")

func isNoRows(err error) bool {
	return errors.Is(err, pgx.ErrNoRows)
}
