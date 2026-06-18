import { NextResponse } from 'next/server'
import { runIngest } from '@/ingest'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

// POST /api/ingest  — disparado por el cron de Coolify.
// Protegido con Authorization: Bearer $INGEST_TOKEN.
export async function POST(req: Request) {
  const token = process.env.INGEST_TOKEN
  const auth = req.headers.get('authorization')
  if (token && auth !== `Bearer ${token}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const started = Date.now()
  const result = await runIngest()
  return NextResponse.json({ ...result, ms: Date.now() - started })
}

// GET para comodidad en dev (mismo token por querystring ?token=).
export async function GET(req: Request) {
  const token = process.env.INGEST_TOKEN
  const url = new URL(req.url)
  if (token && url.searchParams.get('token') !== token) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const result = await runIngest()
  return NextResponse.json(result)
}
