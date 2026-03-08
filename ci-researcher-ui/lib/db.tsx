import { Pool } from 'pg'

if (!process.env.POSTGRES_URL) {
  throw new Error('POSTGRES_URL is not set — check your .env file')
}

const globalForPg = globalThis as unknown as { _pgPool?: Pool }

export const pool = globalForPg._pgPool ?? new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
})

if (process.env.NODE_ENV !== 'production') {
  globalForPg._pgPool = pool
}