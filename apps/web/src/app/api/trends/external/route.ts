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

// Google Trends: búsquedas en tendencia hoy (RSS diario por país).
async function google(lang: string): Promise<TrendItem[]> {
  const geo = lang === 'en' ? 'US' : 'ES'
  const feed = await parser.parseURL(
    `https://trends.google.com/trends/trendingsearches/daily/rss?geo=${geo}`,
  )
  return (feed.items ?? [])
    .slice(0, 12)
    .map((it) => {
      const term = (it.title ?? '').trim()
      const traffic = (it as Record<string, unknown>)['ht:approx_traffic'] as string | undefined
      return {
        title: term,
        url: it.link || `https://www.google.com/search?q=${encodeURIComponent(term)}`,
        info: traffic,
      }
    })
    .filter((x) => x.title)
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
      else if (src === 'google') out.google = await cached(`gt:${lang}`, () => google(lang))
    }),
  )
  return NextResponse.json(out)
}
