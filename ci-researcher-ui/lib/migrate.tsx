import { pool } from './db'

export async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS reports (
      id          SERIAL PRIMARY KEY,
      topic       TEXT        NOT NULL,
      report_html TEXT        NOT NULL,
      cred_label  TEXT        NOT NULL,
      source_count INT        NOT NULL DEFAULT 0,
      elapsed     TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `)
  console.log('✅ reports table ready')
}