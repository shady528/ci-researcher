import { pool } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/reports?search=xxx&tag=yyy
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search')?.trim() ?? ''
    const tag    = searchParams.get('tag')?.trim() ?? ''

    let query  = `
      SELECT id, topic, cred_label, source_count, elapsed, tags, created_at
      FROM reports
    `
    const params: string[] = []
    const conditions: string[] = []

    if (search) {
      params.push(`%${search}%`)
      conditions.push(`topic ILIKE $${params.length}`)
    }
    if (tag) {
      params.push(tag)
      conditions.push(`$${params.length} = ANY(tags)`)
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`
    }

    query += ` ORDER BY created_at DESC LIMIT 20`

    const { rows } = await pool.query(query, params)
    return NextResponse.json(rows)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// POST /api/reports
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { topic, report_html, cred_label, source_count, elapsed, tags } = body

    const { rows } = await pool.query(
      `INSERT INTO reports (topic, report_html, cred_label, source_count, elapsed, tags)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [topic, report_html, cred_label, source_count ?? 0, elapsed ?? '—', tags ?? []]
    )
    return NextResponse.json({ id: rows[0].id })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}