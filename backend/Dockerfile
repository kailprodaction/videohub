# syntax=docker/dockerfile:1.6

# --- build stage ----------------------------------------------------------
FROM golang:1.22-alpine AS build

WORKDIR /src
ENV CGO_ENABLED=0 GOOS=linux

# Сначала только модули — лучше кешируется при изменениях кода.
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN go build -trimpath -ldflags="-s -w" -o /out/videohub-server ./cmd/server

# --- runtime stage --------------------------------------------------------
FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata \
    && adduser -D -u 1001 app

WORKDIR /app

COPY --from=build /out/videohub-server /app/videohub-server
COPY migrations /app/migrations

# uploads — volume; создаём заранее, чтобы права были у app.
RUN mkdir -p /app/uploads/MP4 /app/uploads/PNG /app/uploads/ADS && chown -R app:app /app

USER app

EXPOSE 8080

ENV HTTP_ADDR=:8080 \
    UPLOADS_DIR=/app/uploads

ENTRYPOINT ["/app/videohub-server"]
