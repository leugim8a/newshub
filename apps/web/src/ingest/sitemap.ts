import * as cheerio from 'cheerio'
import { query } from '@/lib/db'
import type { Connector, RawArticle } from './types'

// Conector de sitemap: ingiere las entradas recientes de un sitemap.xml leyendo
// la página de cada una y extrayendo og:title / og:image / og:description.
// Útil para newsletters/medios con archivo público pero sin RSS (p.ej. beehiiv).
// config: { pathFilter?: string, limit?: number }

type Entry = { loc: string; lastmod: string | null }

function parseSitemap(xml: string): Entry[] {
  const out: Entry[] = []
  const blocks = xml.match(/<url>[\s\S]*?<\/url>/g) ?? []
  for (const b of blocks) {
    const loc = b.match(/<loc>([^<]+)<\/loc>/)?.[1]?.trim()
    if (!loc) continue
    const lastmod = b.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1]?.trim() ?? null
    out.push({ loc, lastmod })
  }
  return out
}

async function fetchMeta(url: string, ua: string) {
  const res = await fetch(url, { headers: { 'user-agent': ua }, signal: AbortSignal.timeout(8000) })
  if (!res.ok) return null
  const html = (await res.text()).slice(0, 600_000)
  const $ = cheerio.load(html)
  const get = (sel: string) => $(sel).attr('content')?.trim()
  const title = get('meta[property="og:title"]') || $('title').first().text().trim()
  if (!title) return null
  const image =
    get('meta[property="og:image"]') || get('meta[name="twitter:image"]') || null
  const summary =
    get('meta[property="og:description"]') || get('meta[name="description"]') || null
  return { title, image, summary }
}

export const sitemapConnector: Connector = async (source) => {
  const cfg = source.config as { pathFilter?: string; limit?: number }
  const ua = 'Mozilla/5.0 (compatible; NewsHubBot/0.2; +https://newshub.app)'
  const limit = Math.min(cfg.limit ?? 20, 40)

  const res = await fetch(source.url, {
    headers: { 'user-agent': ua },
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) return []
  let entries = parseSitemap(await res.text())

  if (cfg.pathFilter) entries = entries.filter((e) => e.loc.includes(cfg.pathFilter as string))
  // Más recientes primero (por lastmod si existe).
  entries.sort((a, b) => (b.lastmod ?? '').localeCompare(a.lastmod ?? ''))
  const candidates = entries.slice(0, limit)

  // Saltar las que ya están ingeridas (evita re-descargar páginas en cada ciclo).
  const urls = candidates.map((e) => e.loc)
  const { rows: existing } = await query<{ url: string }>(
    `SELECT url FROM articles WHERE url = ANY($1::text[])`,
    [urls],
  )
  const seen = new Set(existing.map((r) => r.url))
  const fresh = candidates.filter((e) => !seen.has(e.loc))

  const out: RawArticle[] = []
  for (let i = 0; i < fresh.length; i += 5) {
    const batch = fresh.slice(i, i + 5)
    const metas = await Promise.all(
      batch.map(async (e) => {
        try {
          const m = await fetchMeta(e.loc, ua)
          return m ? { e, m } : null
        } catch {
          return null
        }
      }),
    )
    for (const x of metas) {
      if (!x) continue
      out.push({
        url: x.e.loc,
        title: x.m.title,
        summary: x.m.summary,
        imageUrl: x.m.image,
        lang: source.lang,
        publishedAt: x.e.lastmod,
      })
    }
  }
  return out
}
