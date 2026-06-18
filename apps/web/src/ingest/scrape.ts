import * as cheerio from 'cheerio'
import type { Connector, RawArticle } from './types'

// Conector de scraping a medida — scaffold para medios sin RSS.
// La configuración define los selectores CSS (source.config):
//   { itemSelector, linkSelector, titleSelector, base }
// Respetar robots.txt y términos de cada medio antes de activar una fuente.
export const scrapeConnector: Connector = async (source) => {
  const cfg = source.config as {
    itemSelector?: string
    titleSelector?: string
    base?: string
  }
  const itemSelector = cfg.itemSelector || 'article a'
  const base = cfg.base || new URL(source.url).origin

  const res = await fetch(source.url, {
    headers: { 'user-agent': 'NewsHubBot/0.1 (+https://newshub.app)' },
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) return []
  const html = await res.text()
  const $ = cheerio.load(html)

  const out: RawArticle[] = []
  const seen = new Set<string>()
  $(itemSelector).each((_, el) => {
    const a = $(el)
    const href = a.attr('href')
    const title = (cfg.titleSelector ? a.find(cfg.titleSelector).text() : a.text()).trim()
    if (!href || !title || title.length < 12) return
    const url = href.startsWith('http') ? href : new URL(href, base).toString()
    if (seen.has(url)) return
    seen.add(url)
    out.push({ url, title, lang: source.lang, summary: null, publishedAt: null })
  })
  return out.slice(0, 40)
}
