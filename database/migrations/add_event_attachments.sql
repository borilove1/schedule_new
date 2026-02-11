-- Migration: Add event attachments table
-- Date: 2026-02-11
-- Description: 일정 첨부파일 테이블 생성

CREATE TABLE IF NOT EXISTS event_attachments (
    id SERIAL PRIMARY KEY,
    event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
    series_id INTEGER REFERENCES event_series(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    uploaded_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT check_attachment_target CHECK (
        (event_id IS NOT NULL AND series_id IS NULL) OR
        (event_id IS NULL AND series_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_attachments_event_id ON event_attachments(event_id) WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_attachments_series_id ON event_attachments(series_id) WHERE series_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_attachments_uploaded_by ON event_attachments(uploaded_by);
