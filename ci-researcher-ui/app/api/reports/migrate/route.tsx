import { pool } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS reports (
        id           SERIAL PRIMARY KEY,
        topic        TEXT        NOT NULL,
        report_html  TEXT        NOT NULL,
        cred_label   TEXT        NOT NULL,
        source_count INT         NOT NULL DEFAULT 0,
        elapsed      TEXT,
        tags         TEXT[]      NOT NULL DEFAULT '{}',
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `)
    // Add tags column if table already exists without it
    await pool.query(`
      ALTER TABLE reports ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';
    `)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}