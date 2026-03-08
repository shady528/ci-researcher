import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    has_db_url: !!process.env.DATABASE_URL,
    value_start: process.env.DATABASE_URL?.slice(0, 20) ?? 'undefined',
  })
}