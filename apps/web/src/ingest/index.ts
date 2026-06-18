import { createHash } from 'node:crypto'
import { query } from '@/lib/db'
import { publish } from '@/lib/realtime'
import { sendPush, type PushSub } from '@/lib/push'
import { newsapiConnector } from './newsapi'
import { rssConnector } from './rss'
import { scrapeConnector } from './scrape'
import type { Connector, RawArticle, SourceRow } from './types'

const connectors: Record<SourceRow['kind'], Connector> = {
  rss: rssConnector,
  newsapi: newsapiConnector,
  scrape: scrapeConnector,
}

// URL canónica: sin query/fragment ni barra final, en minúsculas el host.
function canonicalUrl(raw: string): string {
  try {
    const u = new URL(raw)
    u.hash = ''
    u.search = ''
    u.host = u.host.toLowerCase()
    let s = u.toString()
    if (s.endsWith('/')) s = s.slice(0, -1)
    return s
  } catch {
    return raw
  }
}

function titleHash(title: string): string {
  const norm = title.toLowerCase().replace(/\s+/g, ' ').trim()
  return createHash('sha1').update(norm).digest('hex')
}

type TopicRow = { id: number; slug: string; label: string; keywords: string[] }

// Tokeniza por separadores no alfanuméricos (regex literal estático con flag
// unicode, a prueba de transpilación) para casar por palabra completa y evitar
// falsos positivos tipo "ai" dentro de "Spain".
const TOKEN_SPLIT = /[^\p{L}\p{N}]+/u

function matchTopics(article: RawArticle, topics: TopicRow[]): TopicRow[] {
  const hayLower = `${article.title} ${article.summary ?? ''}`.toLowerCase()
  const tokens = new Set(hayLower.split(TOKEN_SPLIT).filter(Boolean))
  return topics.filter((t) =>
    t.keywords.some((raw) => {
      const k = raw.trim().toLowerCase()
      if (!k) return false
      // Frases (varias palabras) → subcadena; palabra suelta → token exacto.
      return k.includes(' ') ? hayLower.includes(k) : tokens.has(k)
    }),
  )
}

export type IngestResult = {
  sources: number
  fetched: number
  inserted: number
  notifications: number
  errors: { source: string; error: string }[]
}

export async function runIngest(): Promise<IngestResult> {
  const result: IngestResult = {
    sources: 0,
    fetched: 0,
    inserted: 0,
    notifications: 0,
    errors: [],
  }

  const { rows: sources } = await query<SourceRow>(
    `SELECT id, kind, name, url, lang, config FROM sources WHERE active = true`,
  )
  const { rows: topics } = await query<TopicRow>(
    `SELECT id, slug, label, keywords FROM topics WHERE followed = true`,
  )
  result.sources = sources.length

  for (const source of sources) {
    try {
      const articles = await connectors[source.kind](source)
      result.fetched += articles.length

      for (const a of articles) {
        const urlCanonical = canonicalUrl(a.url)
        const tHash = titleHash(a.title)

        const insert = await query<{ id: number }>(
          `INSERT INTO articles (source_id, url, url_canonical, title, title_hash, summary, image_url, lang, published_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT DO NOTHING
           RETURNING id`,
          [
            source.id,
            a.url,
            urlCanonical,
            a.title,
            tHash,
            a.summary ?? null,
            a.imageUrl ?? null,
            a.lang,
            a.publishedAt ?? null,
          ],
        )
        if (insert.rows.length === 0) continue // duplicado
        result.inserted++
        const articleId = insert.rows[0].id

        const matched = matchTopics(a, topics)
        for (const topic of matched) {
          await query(
            `INSERT INTO article_topics (article_id, topic_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
            [articleId, topic.id],
          )
          await notify(articleId, topic, a, result)
        }
      }

      await query(`UPDATE sources SET last_fetch = NOW() WHERE id = $1`, [source.id])
    } catch (err) {
      result.errors.push({ source: source.name, error: (err as Error).message })
    }
  }

  return result
}

async function notify(
  articleId: number,
  topic: TopicRow,
  article: RawArticle,
  result: IngestResult,
) {
  await query(
    `INSERT INTO notifications (article_id, topic_id, title, body) VALUES ($1,$2,$3,$4)`,
    [articleId, topic.id, article.title, `${topic.label} · ${new URL(article.url).host}`],
  )
  result.notifications++

  const event = {
    type: 'notification' as const,
    title: article.title,
    body: topic.label,
    url: article.url,
    topic: topic.slug,
    at: new Date().toISOString(),
  }
  publish(event)

  // Web Push a los suscriptores de este tema (o a todos si no filtran temas).
  const { rows: subs } = await query<{
    id: number
    endpoint: string
    p256dh: string
    auth: string
  }>(
    `SELECT id, endpoint, p256dh, auth FROM push_subscriptions
     WHERE topic_slugs = '{}' OR $1 = ANY(topic_slugs)`,
    [topic.slug],
  )
  for (const s of subs) {
    const sub: PushSub = { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }
    const r = await sendPush(sub, { title: article.title, body: topic.label, url: article.url })
    if (r.gone) {
      await query(`DELETE FROM push_subscriptions WHERE id = $1`, [s.id])
    }
  }
}
