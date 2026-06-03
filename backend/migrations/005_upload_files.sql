CREATE TABLE IF NOT EXISTS upload_files (
    path          TEXT PRIMARY KEY,
    content_type  TEXT NOT NULL,
    size_bytes    BIGINT NOT NULL,
    data          BYTEA NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_upload_files_created ON upload_files(created_at DESC);
