export type SourceRow = {
  id: number
  kind: 'rss' | 'newsapi' | 'scrape' | 'sitemap'
  name: string
  url: string
  lang: string
  config: Record<string, unknown>
}

// Artículo normalizado que devuelve cada conector.
export type RawArticle = {
  url: string
  title: string
  summary?: string | null
  imageUrl?: string | null
  lang: string
  publishedAt?: string | null
}

export type Connector = (source: SourceRow) => Promise<RawArticle[]>
