import { NextResponse } from 'next/server'
import Parser from 'rss-parser'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const parser = new Parser({ timeout: 15000 })

// GET — lista de fuentes RSS gestionables (excluye las internas de búsqueda).
export async function GET() {
  const { rows } = await query(
    `SELECT s.id, s.name, s.url, s.lang, s.active, s.last_fetch,
            count(a.id) AS article_count
     FROM sources s
     LEFT JOIN articles a ON a.source_id = s.id
     WHERE s.kind = 'rss' AND s.url <> 'https://news.google.com/rss/search'
     GROUP BY s.id
     ORDER BY s.active DESC, s.name`,
  )
  return NextResponse.json({ sources: rows })
}

// POST { url, name?, lang? } — añade una fuente RSS (valida parseando el feed).
export async function POST(req: Request) {
  const body = (await req.json()) as { url?: string; name?: string; lang?: string }
  const url = (body.url ?? '').trim()
  if (!url || !/^https?:\/\//.test(url)) {
    return NextResponse.json({ error: 'URL inválida' }, { status: 400 })
  }

  let feed: Parser.Output<Record<string, unknown>>
  try {
    feed = await parser.parseURL(url)
  } catch {
    return NextResponse.json({ error: 'no se pudo leer el RSS de esa URL' }, { status: 422 })
  }

  const name = (body.name?.trim() || feed.title || new URL(url).host).slice(0, 120)
  const lang = body.lang === 'en' ? 'en' : 'es'
  const ins = await query<{ id: number }>(
    `INSERT INTO sources (kind, name, url, lang, active)
     VALUES ('rss', $1, $2, $3, true)
     ON CONFLICT (kind, url) DO UPDATE SET active = true, name = EXCLUDED.name
     RETURNING id`,
    [name, url, lang],
  )
  return NextResponse.json({ ok: true, id: ins.rows[0].id, name, items: feed.items?.length ?? 0 })
}

// PATCH { id, active } — activar / pausar.
export async function PATCH(req: Request) {
  const body = (await req.json()) as { id?: number; active?: boolean }
  if (!body.id || typeof body.active !== 'boolean') {
    return NextResponse.json({ error: 'id y active requeridos' }, { status: 400 })
  }
  await query(`UPDATE sources SET active = $2 WHERE id = $1 AND kind = 'rss'`, [body.id, body.active])
  return NextResponse.json({ ok: true })
}

// DELETE { id } — eliminar una fuente.
export async function DELETE(req: Request) {
  const body = (await req.json()) as { id?: number }
  if (!body.id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })
  await query(`DELETE FROM sources WHERE id = $1 AND kind = 'rss'`, [body.id])
  return NextResponse.json({ ok: true })
}
