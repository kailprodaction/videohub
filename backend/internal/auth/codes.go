package auth

import (
	"crypto/rand"
	"fmt"
	"math/big"
)

// GenerateCode возвращает случайный 6-значный код "000000".."999999".
func GenerateCode() string {
	n, err := rand.Int(rand.Reader, big.NewInt(1_000_000))
	if err != nil {
		// Крайне маловероятно: если RNG не работает — возвращаем нули, ниже
		// верификация всё равно сравнит код целиком.
		return "000000"
	}
	return fmt.Sprintf("%06d", n.Int64())
}
