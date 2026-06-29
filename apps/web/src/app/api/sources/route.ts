import { NextResponse } from 'next/server'
import Parser from 'rss-parser'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const parser = new Parser({ timeout: 15000 })

// GET — lista de fuentes gestionables (excluye las internas de búsqueda).
export async function GET() {
  const { rows } = await query(
    `SELECT s.id, s.name, s.url, s.lang, s.kind, s.active, s.last_fetch, s.objectivity,
            count(a.id) AS article_count
     FROM sources s
     LEFT JOIN articles a ON a.source_id = s.id
     WHERE s.kind IN ('rss', 'sitemap', 'scrape')
       AND s.url <> 'https://news.google.com/rss/search'
     GROUP BY s.id
     ORDER BY s.active DESC, s.name`,
  )
  return NextResponse.json({ sources: rows })
}

// Detecta el segmento de ruta más común entre las URLs de un sitemap (p.ej. '/p/').
function detectPathFilter(locs: string[]): string | undefined {
  const counts: Record<string, number> = {}
  for (const l of locs) {
    try {
      const seg = new URL(l).pathname.split('/').filter(Boolean)[0]
      if (seg) counts[seg] = (counts[seg] ?? 0) + 1
    } catch {
      /* ignore */
    }
  }
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
  return top && top[1] >= 3 ? `/${top[0]}/` : undefined
}

// POST { url, name?, lang? } — añade una fuente. Detecta RSS o sitemap.
export async function POST(req: Request) {
  const body = (await req.json()) as { url?: string; name?: string; lang?: string }
  const url = (body.url ?? '').trim()
  if (!url || !/^https?:\/\//.test(url)) {
    return NextResponse.json({ error: 'URL inválida' }, { status: 400 })
  }
  const lang = body.lang === 'en' ? 'en' : 'es'

  let text: string
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; NewsHubBot/0.2)' },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) throw new Error('http ' + res.status)
    text = await res.text()
  } catch {
    return NextResponse.json({ error: 'no se pudo leer esa URL' }, { status: 422 })
  }

  // ¿Es un sitemap?
  if (/<urlset|<sitemapindex/i.test(text)) {
    const locs = [...text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim())
    if (locs.length === 0) {
      return NextResponse.json({ error: 'sitemap sin URLs' }, { status: 422 })
    }
    const pathFilter = detectPathFilter(locs)
    const name = (body.name?.trim() || new URL(url).host).slice(0, 120)
    const ins = await query<{ id: number }>(
      `INSERT INTO sources (kind, name, url, lang, active, config)
       VALUES ('sitemap', $1, $2, $3, true, $4)
       ON CONFLICT (kind, url) DO UPDATE SET active = true, name = EXCLUDED.name, config = EXCLUDED.config
       RETURNING id`,
      [name, url, lang, JSON.stringify({ pathFilter, limit: 20 })],
    )
    const matched = pathFilter ? locs.filter((l) => l.includes(pathFilter)).length : locs.length
    return NextResponse.json({ ok: true, id: ins.rows[0].id, name, kind: 'sitemap', items: matched })
  }

  // Si no, intentar como RSS.
  let feed: Parser.Output<Record<string, unknown>>
  try {
    feed = await parser.parseString(text)
  } catch {
    return NextResponse.json(
      { error: 'la URL no es un RSS ni un sitemap válido' },
      { status: 422 },
    )
  }
  const name = (body.name?.trim() || feed.title || new URL(url).host).slice(0, 120)
  const ins = await query<{ id: number }>(
    `INSERT INTO sources (kind, name, url, lang, active)
     VALUES ('rss', $1, $2, $3, true)
     ON CONFLICT (kind, url) DO UPDATE SET active = true, name = EXCLUDED.name
     RETURNING id`,
    [name, url, lang],
  )
  return NextResponse.json({ ok: true, id: ins.rows[0].id, name, kind: 'rss', items: feed.items?.length ?? 0 })
}

// PATCH { id, active? , objectivity? } — activar/pausar o fijar objetividad.
export async function PATCH(req: Request) {
  const body = (await req.json()) as {
    id?: number
    active?: boolean
    objectivity?: 'objective' | 'mixed' | 'biased' | null
  }
  if (!body.id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  if (typeof body.active === 'boolean') {
    await query(
      `UPDATE sources SET active = $2 WHERE id = $1 AND kind IN ('rss','sitemap','scrape')`,
      [body.id, body.active],
    )
  }
  if ('objectivity' in body) {
    const v = body.objectivity
    const valid = v === 'objective' || v === 'mixed' || v === 'biased' ? v : null
    await query(`UPDATE sources SET objectivity = $2 WHERE id = $1`, [body.id, valid])
  }
  return NextResponse.json({ ok: true })
}

// DELETE { id } — eliminar una fuente.
export async function DELETE(req: Request) {
  const body = (await req.json()) as { id?: number }
  if (!body.id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })
  await query(`DELETE FROM sources WHERE id = $1 AND kind IN ('rss','sitemap','scrape')`, [body.id])
  return NextResponse.json({ ok: true })
}
