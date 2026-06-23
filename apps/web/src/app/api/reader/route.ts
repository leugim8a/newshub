import { NextResponse } from 'next/server'
import * as cheerio from 'cheerio'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const maxDuration = 20

// GET /api/reader?id= — extrae el texto principal del artículo (reader view).
// Usa el id (la URL viene de BD) para no aceptar URLs arbitrarias.
export async function GET(req: Request) {
  const id = Number(new URL(req.url).searchParams.get('id'))
  if (!id) return NextResponse.json({ error: 'id' }, { status: 400 })

  const { rows } = await query<{ url: string; title: string; image_url: string | null; source_name: string | null }>(
    `SELECT a.url, a.title, a.image_url, s.name AS source_name
     FROM articles a LEFT JOIN sources s ON s.id = a.source_id WHERE a.id = $1`,
    [id],
  )
  if (rows.length === 0) return NextResponse.json({ error: 'no encontrado' }, { status: 404 })
  const art = rows[0]

  try {
    const res = await fetch(art.url, {
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; NewsHubBot/0.3; +https://newshub.app)' },
      signal: AbortSignal.timeout(12000),
      redirect: 'follow',
    })
    if (!res.ok) throw new Error('http ' + res.status)
    const html = (await res.text()).slice(0, 2_000_000)
    const $ = cheerio.load(html)

    $('script, style, nav, header, footer, aside, form, figure, iframe, .ad, .ads, .newsletter, .related, [aria-hidden=true]').remove()

    // Contenedor con más texto en <p> (heurística readability simple).
    let best: cheerio.Cheerio<never> | null = null
    let bestLen = 0
    const candidates = $('article, main, [role=main], .article-body, .post-content, .entry-content, .content, body')
    candidates.each((_, el) => {
      const $el = $(el)
      const len = $el.find('p').text().length
      if (len > bestLen) {
        bestLen = len
        best = $el as never
      }
    })
    const root = best ?? $('body')

    const ogImage =
      $('meta[property="og:image"]').attr('content') || art.image_url || null
    const byline =
      $('meta[name="author"]').attr('content') ||
      $('[rel=author]').first().text().trim() ||
      undefined

    const blocks: { tag: 'p' | 'h'; text: string }[] = []
    root.find('p, h2, h3').each((_, el) => {
      const tag = el.tagName?.toLowerCase()
      const text = $(el).text().replace(/\s+/g, ' ').trim()
      if (!text || text.length < 30) return
      blocks.push({ tag: tag === 'p' ? 'p' : 'h', text })
    })

    return NextResponse.json({
      title: art.title,
      url: art.url,
      source: art.source_name,
      image: ogImage,
      byline,
      blocks: blocks.slice(0, 120),
      extracted: blocks.length > 0,
    })
  } catch {
    return NextResponse.json({
      title: art.title,
      url: art.url,
      source: art.source_name,
      image: art.image_url,
      blocks: [],
      extracted: false,
    })
  }
}
