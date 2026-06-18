import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await query('SELECT 1')
    return NextResponse.json({ status: 'ok', db: 'up', ts: new Date().toISOString() })
  } catch (err) {
    return NextResponse.json(
      { status: 'degraded', db: 'down', error: (err as Error).message },
      { status: 503 },
    )
  }
}
