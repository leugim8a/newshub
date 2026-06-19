import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { backfillTopic } from '@/lib/backfill'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

// Mantenimiento: rellena los temas propios existentes con artículos ya ingeridos.
// Protegido con INGEST_TOKEN (mismo que el cron). Útil tras añadir el backfill,
// para temas creados antes del fix.
async function run(req: Request): Promise<Response> {
  const token = process.env.INGEST_TOKEN
  const auth = req.headers.get('authorization')
  const url = new URL(req.url)
  const ok = !token || auth === `Bearer ${token}` || url.searchParams.get('token') === token
  if (!ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { rows } = await query<{ id: number; slug: string; keywords: string[] }>(
    `SELECT id, slug, keywords FROM topics WHERE kind = 'custom'`,
  )
  const results: { slug: string; matched: number }[] = []
  for (const t of rows) {
    const matched = await backfillTopic(t.id, t.keywords, 30)
    results.push({ slug: t.slug, matched })
  }
  return NextResponse.json({ topics: rows.length, results })
}

export async function POST(req: Request) {
  return run(req)
}
export async function GET(req: Request) {
  return run(req)
}
