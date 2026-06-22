import { NextResponse } from 'next/server'
import Parser from 'rss-parser'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

type TrendItem = { title: string; url: string; info?: string }

const parser = new Parser({ timeout: 12000 })
const UA = 'Mozilla/5.0 (compatible; NewsHubBot/0.3; +https://newshub.app)'

// Caché en memoria (por proceso) para no martillear las APIs externas.
const cache = new Map<string, { at: number; data: TrendItem[] }>()
const TTL = 30 * 60 * 1000

async function cached(key: string, fn: () => Promise<TrendItem[]>): Promise<TrendItem[]> {
  const c = cache.get(key)
  if (c && Date.now() - c.at < TTL) return c.data
  const data = await fn().catch(() => [])
  cache.set(key, { at: Date.now(), data })
  return data
}

// Wikipedia: artículos MÁS VISTOS (visitas reales) del día anterior.
async function wikipedia(lang: string): Promise<TrendItem[]> {
  const project = lang === 'en' ? 'en.wikipedia.org' : 'es.wikipedia.org'
  const d = new Date(Date.now() - 24 * 3600 * 1000)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/top/${project}/all-access/${y}/${m}/${day}`
  const res = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(12000) })
  if (!res.ok) return []
  const data = (await res.json()) as { items?: { articles?: { article: string; views: number }[] }[] }
  const articles = data.items?.[0]?.articles ?? []
  const skip = /^(Main_Page|Special:|Wikipedia:|Especial:|Portada|Categoría:|Category:|Wikiproyecto)/i
  return articles
    .filter((a) => !skip.test(a.article))
    .slice(0, 12)
    .map((a) => ({
      title: a.article.replace(/_/g, ' '),
      url: `https://${project}/wiki/${encodeURIComponent(a.article)}`,
      info: `${a.views.toLocaleString('es')} vistas`,
    }))
}

// Mastodon: enlaces de noticias en tendencia en el fediverso.
async function mastodon(): Promise<TrendItem[]> {
  const res = await fetch('https://mastodon.social/api/v1/trends/links?limit=12', {
    headers: { 'user-agent': UA },
    signal: AbortSignal.timeout(12000),
  })
  if (!res.ok) return []
  const data = (await res.json()) as { url: string; title: string; provider_name?: string }[]
  return (data ?? [])
    .filter((x) => x.url)
    .slice(0, 12)
    .map((x) => ({ title: x.title || x.url, url: x.url, info: x.provider_name || undefined }))
}

// arXiv: investigación reciente (IA / aprendizaje automático / NLP).
async function arxiv(): Promise<TrendItem[]> {
  const q = 'cat:cs.AI+OR+cat:cs.LG+OR+cat:cs.CL'
  const feed = await parser.parseURL(
    `https://export.arxiv.org/api/query?search_query=${q}&sortBy=submittedDate&sortOrder=descending&max_results=12`,
  )
  return (feed.items ?? [])
    .slice(0, 12)
    .map((it) => ({
      title: (it.title ?? '').replace(/\s+/g, ' ').trim(),
      url: it.link ?? '',
      info: 'arXiv',
    }))
    .filter((x) => x.url && x.title)
}

// Google Trends: búsquedas en tendencia hoy (RSS por país). URL nueva
// (/trending/rss); los campos ht:* son namespaced → parseo manual.
function decodeXml(s: string): string {
  return s
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}
// "200+", "2K+", "1M+" → número (para ordenar por volumen de búsqueda).
function parseTraffic(s: string): number {
  const m = (s || '').replace(/[+,\s]/g, '').match(/^([\d.]+)([KM]?)$/i)
  if (!m) return 0
  let n = parseFloat(m[1])
  if (/k/i.test(m[2])) n *= 1000
  else if (/m/i.test(m[2])) n *= 1_000_000
  return n
}
async function google(lang: string): Promise<TrendItem[]> {
  const geo = lang === 'en' ? 'US' : 'ES'
  const res = await fetch(`https://trends.google.com/trending/rss?geo=${geo}`, {
    headers: { 'user-agent': UA },
    signal: AbortSignal.timeout(12000),
  })
  if (!res.ok) return []
  const xml = await res.text()
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/g) ?? []
  return blocks
    .map((b) => {
      const term = decodeXml((b.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '').trim())
      const traffic = (b.match(/<ht:approx_traffic>([^<]*)<\/ht:approx_traffic>/)?.[1] ?? '').trim()
      const newsUrl = b.match(/<ht:news_item_url>([^<]*)<\/ht:news_item_url>/)?.[1]?.trim()
      return {
        title: term,
        url: newsUrl || `https://www.google.com/search?q=${encodeURIComponent(term)}`,
        info: traffic || undefined,
        _t: parseTraffic(traffic),
      }
    })
    .filter((x) => x.title)
    .sort((a, b) => b._t - a._t) // ordenar por volumen de búsqueda
    .slice(0, 12)
    .map(({ _t, ...rest }) => rest)
}

// GET /api/trends/external?sources=wikipedia,mastodon,google&lang=es
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const lang = searchParams.get('lang') === 'en' ? 'en' : 'es'
  const sources = (searchParams.get('sources') || 'wikipedia,mastodon,google').split(',')

  const out: Record<string, TrendItem[]> = {}
  await Promise.all(
    sources.map(async (src) => {
      if (src === 'wikipedia') out.wikipedia = await cached(`wiki:${lang}`, () => wikipedia(lang))
      else if (src === 'mastodon') out.mastodon = await cached('masto', () => mastodon())
      else if (src === 'arxiv') out.arxiv = await cached('arxiv', () => arxiv())
      else if (src === 'google') out.google = await cached(`gt:${lang}`, () => google(lang))
    }),
  )
  return NextResponse.json(out)
}
