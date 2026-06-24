import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { rssConnector } from '@/ingest/rss'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// GET ?token=&name= — para el canal cuyo nombre casa, rastrea su feed y para los
// primeros vídeos dice si existen en articles y bajo qué fuente / si están etiquetados.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  if (searchParams.get('token') !== process.env.INGEST_TOKEN)
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const name = searchParams.get('name') ?? 'AI Explained'

  const { rows: srcs } = await query<{ id: number; name: string; url: string; lang: string; topic_id: number | null }>(
    `SELECT id, name, url, lang, topic_id FROM sources WHERE name ILIKE $1 AND url LIKE '%youtube%' ORDER BY active DESC`,
    [`%${name}%`],
  )
  if (srcs.length === 0) return NextResponse.json({ error: 'fuente no encontrada' })
  const src = srcs[0]

  const arts = await rssConnector({ id: src.id, kind: 'rss', name: src.name, url: src.url, lang: src.lang, config: {} })
  const checks = []
  for (const a of arts.slice(0, 4)) {
    const vid = (a.url.match(/v=([\w-]+)/) || [])[1] ?? a.url
    const { rows } = await query<{ id: number; source_id: number; sname: string; tagged: boolean }>(
      `SELECT ar.id, ar.source_id, s.name AS sname,
              EXISTS(SELECT 1 FROM article_topics t WHERE t.article_id = ar.id AND t.topic_id = $2) AS tagged
         FROM articles ar JOIN sources s ON s.id = ar.source_id
        WHERE ar.url ILIKE $1 LIMIT 1`,
      [`%${vid}%`, src.topic_id],
    )
    checks.push({ video: a.title.slice(0, 40), found: rows[0] ?? null })
  }
  return NextResponse.json({
    source: { id: src.id, name: src.name, topic_id: src.topic_id, url: src.url },
    sourcesMatching: srcs.length,
    checks,
  })
}
