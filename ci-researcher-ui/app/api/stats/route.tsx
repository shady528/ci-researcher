import { pool } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const { rows } = await pool.query(`
      SELECT
        COUNT(*)::int                                          AS total_runs,
        ROUND(AVG(source_count)::numeric, 1)                  AS avg_sources,
        COUNT(*) FILTER (WHERE cred_label = 'Strong')::int    AS strong_count,
        COUNT(*) FILTER (WHERE cred_label = 'Moderate')::int  AS moderate_count,
        COUNT(*) FILTER (WHERE cred_label = 'Limited')::int   AS limited_count,
        (
          SELECT topic FROM reports
          GROUP BY topic ORDER BY COUNT(*) DESC LIMIT 1
        )                                                      AS top_topic,
        (
          SELECT ARRAY_AGG(DISTINCT tag)
          FROM reports, UNNEST(tags) AS tag
          WHERE tag != ''
        )                                                      AS all_tags
      FROM reports
    `)
    return NextResponse.json(rows[0])
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}