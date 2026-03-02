# src/db/setup.py
import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

CREATE_TABLES = """
CREATE TABLE IF NOT EXISTS runs (
    run_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic         TEXT NOT NULL,
    source_mode   VARCHAR(20) NOT NULL,
    status        VARCHAR(20) DEFAULT 'running',
    iteration_count INT DEFAULT 0,
    avg_credibility FLOAT,
    delivery_status VARCHAR(20) DEFAULT 'pending',
    created_at    TIMESTAMP DEFAULT NOW(),
    completed_at  TIMESTAMP
);

CREATE TABLE IF NOT EXISTS docs (
    doc_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id            UUID REFERENCES runs(run_id),
    url_or_filename   TEXT,
    source_type       VARCHAR(30),
    credibility_score FLOAT,
    recency_score     FLOAT,
    is_internal       BOOLEAN DEFAULT FALSE,
    content_preview   TEXT,
    created_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gaps_log (
    gap_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id       UUID REFERENCES runs(run_id),
    iteration    INT,
    description  TEXT,
    suggested_query TEXT,
    resolved     BOOLEAN DEFAULT FALSE,
    created_at   TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS delivery_events (
    event_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id       UUID REFERENCES runs(run_id),
    channel      VARCHAR(20),
    recipient    TEXT,
    status_code  INT,
    success      BOOLEAN,
    error_msg    TEXT,
    sent_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS uploaded_files (
    file_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename      TEXT NOT NULL,
    size_bytes    INT,
    local_path    TEXT,
    ingested_at   TIMESTAMP DEFAULT NOW(),
    chunk_count   INT DEFAULT 0,
    embedding_model VARCHAR(60)
);
"""

def setup_db():
    conn = psycopg2.connect(os.getenv("POSTGRES_URL"))
    cur = conn.cursor()
    cur.execute(CREATE_TABLES)
    conn.commit()
    cur.close()
    conn.close()
    print("✅ All tables created")

if __name__ == "__main__":
    setup_db()