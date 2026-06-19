import type { Connector, RawArticle } from './types'

// Conector News API (NewsAPI.org por defecto; GNews soportable vía config).
// Requiere NEWSAPI_KEY. La query va en source.config.query.
export const newsapiConnector: Connector = async (source) => {
  // Clave por config (BYOK) con fallback a la de la app.
  const key = (source.config.apiKey as string) || process.env.NEWSAPI_KEY
  if (!key) return []

  const provider = process.env.NEWSAPI_PROVIDER || 'newsapi'
  const q = String((source.config.query as string) || source.name)

  let endpoint: string
  if (provider === 'gnews') {
    endpoint = `https://gnews.io/api/v4/search?q=${encodeURIComponent(q)}&lang=${source.lang}&max=25&apikey=${key}`
  } else {
    endpoint = `https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}&language=${source.lang}&pageSize=25&sortBy=publishedAt&apiKey=${key}`
  }

  const res = await fetch(endpoint, { signal: AbortSignal.timeout(15000) })
  if (!res.ok) return []
  const data = (await res.json()) as { articles?: unknown[] }
  const articles = (data.articles ?? []) as Array<Record<string, unknown>>

  return articles
    .map((a): RawArticle | null => {
      const url = (a.url as string) || ''
      const title = (a.title as string) || ''
      if (!url || !title) return null
      return {
        url,
        title: title.trim(),
        summary: ((a.description as string) || '').slice(0, 500) || null,
        imageUrl: (a.image as string) || (a.urlToImage as string) || null,
        lang: source.lang,
        publishedAt: (a.publishedAt as string) || null,
      }
    })
    .filter((x): x is RawArticle => x !== null)
}
