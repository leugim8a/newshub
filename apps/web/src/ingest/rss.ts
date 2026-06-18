import Parser from 'rss-parser'
import type { Connector, RawArticle } from './types'

const parser = new Parser({ timeout: 15000 })

// Conector RSS/Atom — base del MVP.
export const rssConnector: Connector = async (source) => {
  const feed = await parser.parseURL(source.url)
  const items = feed.items ?? []
  const out: RawArticle[] = []
  for (const item of items) {
    if (!item.link || !item.title) continue
    const image =
      (item.enclosure?.url as string | undefined) ||
      ((item as Record<string, unknown>)['media:content'] as { $?: { url?: string } } | undefined)
        ?.$?.url ||
      null
    out.push({
      url: item.link,
      title: item.title.trim(),
      summary: (item.contentSnippet ?? item.content ?? '').slice(0, 500) || null,
      imageUrl: image,
      lang: source.lang,
      publishedAt: item.isoDate ?? item.pubDate ?? null,
    })
  }
  return out
}
