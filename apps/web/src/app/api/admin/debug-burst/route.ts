import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { rssConnector } from '@/ingest/rss'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

// GET ?token= — rastrea TODOS los canales de YouTube activos con el mismo conector
// que la ingesta y reporta items/error por canal. Reproduce la carga real.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  if (searchParams.get('token') !== process.env.INGEST_TOKEN)
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { rows } = await query<{ id: number; name: string; url: string; lang: string }>(
    `SELECT id, name, url, lang FROM sources
      WHERE active = true AND url LIKE 'https://www.youtube.com/feeds/%' ORDER BY id`,
  )
  const out: { name: string; items?: number; error?: string }[] = []
  for (const s of rows) {
    try {
      const arts = await rssConnector({ id: s.id, kind: 'rss', name: s.name, url: s.url, lang: s.lang, config: {} })
      out.push({ name: s.name.replace('YouTube · ', ''), items: arts.length })
    } catch (e) {
      out.push({ name: s.name.replace('YouTube · ', ''), error: (e as Error).message.slice(0, 80) })
    }
  }
  const ok = out.filter((o) => (o.items ?? 0) > 0).length
  return NextResponse.json({ total: rows.length, ok, results: out })
}
