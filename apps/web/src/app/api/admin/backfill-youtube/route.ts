import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { processArticles, loadTopics } from '@/ingest'
import { rssConnector } from '@/ingest/rss'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function emptyResult() {
  return { sources: 0, fetched: 0, inserted: 0, embedded: 0, clusters_touched: 0, notifications: 0, errors: [] as { source: string; error: string }[] }
}

// Rellena canales de YouTube (en especial los que quedaron a 0) UNO A UNO, espaciados
// y con reintento. YouTube limita por ráfaga; aislado y con pausa sí responde.
export async function POST(req: Request) {
  const token = process.env.INGEST_TOKEN
  const auth = req.headers.get('authorization')
  if (token && auth !== `Bearer ${token}`)
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const onlyEmpty = new URL(req.url).searchParams.get('all') !== '1'

  const { rows: sources } = await query<{ id: number; name: string; url: string; lang: string; topic_id: number | null; n: number }>(
    `SELECT s.id, s.name, s.url, s.lang, s.topic_id,
            (SELECT count(*) FROM articles a WHERE a.source_id = s.id)::int AS n
       FROM sources s
      WHERE s.active = true AND s.url LIKE 'https://www.youtube.com/feeds/%'
      ORDER BY n ASC, s.id`,
  )
  const targets = onlyEmpty ? sources.filter((s) => s.n === 0) : sources
  const topics = await loadTopics()
  const report: { name: string; items: number; inserted: number }[] = []

  for (const s of targets) {
    let items = 0
    let inserted = 0
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const arts = await rssConnector({ id: s.id, kind: 'rss', name: s.name, url: s.url, lang: s.lang, config: {} })
        items = arts.length
        if (items > 0) {
          const res = emptyResult()
          await processArticles(s.id, arts, topics, res, false, s.topic_id ?? null)
          inserted = res.inserted
          await query(`UPDATE sources SET last_fetch = NOW() WHERE id = $1`, [s.id])
          break
        }
      } catch {
        /* reintenta */
      }
      await sleep(2000)
    }
    report.push({ name: s.name.replace('YouTube · ', ''), items, inserted })
    await sleep(1500)
  }
  return NextResponse.json({ targets: targets.length, report })
}
