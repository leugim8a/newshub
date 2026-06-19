import Parser from 'rss-parser'
import type { RawArticle } from './types'

// Búsqueda de noticias vía Google News RSS — gratis, sin clave, cobertura enorme
// y multilingüe. Devuelve artículos normalizados para cualquier consulta.
const parser = new Parser({ timeout: 15000 })

const LOCALE: Record<string, { hl: string; gl: string; ceid: string }> = {
  es: { hl: 'es-ES', gl: 'ES', ceid: 'ES:es' },
  en: { hl: 'en-US', gl: 'US', ceid: 'US:en' },
}

// Google News titula "Titular - Medio"; separamos el medio del título.
function splitTitle(raw: string): { title: string; source: string | null } {
  const m = raw.match(/^(.*?)\s+-\s+([^-]+)$/)
  if (m) return { title: m[1].trim(), source: m[2].trim() }
  return { title: raw.trim(), source: null }
}

export async function googleNewsSearch(queryStr: string, lang: string): Promise<RawArticle[]> {
  const q = queryStr.trim()
  if (!q) return []
  const loc = LOCALE[lang] ?? LOCALE.es
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=${loc.hl}&gl=${loc.gl}&ceid=${loc.ceid}`

  const feed = await parser.parseURL(url)
  const out: RawArticle[] = []
  for (const item of feed.items ?? []) {
    if (!item.link || !item.title) continue
    const { title } = splitTitle(item.title)
    if (title.length < 10) continue
    out.push({
      url: item.link,
      title,
      summary: (item.contentSnippet ?? '').slice(0, 500) || null,
      imageUrl: null, // Google News RSS no trae imagen; se enriquece con og:image
      lang,
      publishedAt: item.isoDate ?? item.pubDate ?? null,
    })
  }
  return out.slice(0, 40)
}
