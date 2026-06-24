import Parser from 'rss-parser'
import type { Connector, RawArticle } from './types'

// Muchos feeds (YouTube en especial) bloquean o sirven una página de consentimiento
// al User-Agent por defecto de rss-parser → 0 items. Con UA de navegador + idioma
// responden el Atom correctamente.
const parser = new Parser({
  timeout: 15000,
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
    // El servidor está en la UE: sin esta cookie, YouTube sirve el muro de
    // consentimiento (0 entradas). CONSENT=YES+ lo salta.
    Cookie: 'CONSENT=YES+cb.20210328-17-p0.en+FX+000; SOCS=CAISEwgDEgk0ODE3Nzk3MjQaAmVuIAEaBgiA_LyaBg',
  },
})

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
