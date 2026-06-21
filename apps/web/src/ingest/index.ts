import { createHash } from 'node:crypto'
import { query } from '@/lib/db'
import { embedTexts, embedEnabled, toVector } from '@/lib/embed'
import { publish } from '@/lib/realtime'
import { sendPush, type PushSub } from '@/lib/push'
import { ensureTopicEmbeddings } from '@/lib/topic-vector'
import { enrichRecentImages } from './enrich'
import { googleNewsSearch } from './googlenews'
import { newsapiConnector } from './newsapi'
import { rssConnector } from './rss'
import { scrapeConnector } from './scrape'
import { sitemapConnector } from './sitemap'
import type { Connector, RawArticle, SourceRow } from './types'

const connectors: Record<SourceRow['kind'], Connector> = {
  rss: rssConnector,
  newsapi: newsapiConnector,
  scrape: scrapeConnector,
  sitemap: sitemapConnector,
}

// --- Parámetros de tuning (ver docs/REQUISITOS.md §9) ---
const CLUSTER_WINDOW = '6 hours'
// Asignación de un artículo a un tema (vector limpio del tema vs vector del art):
//  - SEM_HIGH: semántica fuerte por sí sola basta (titular oblicuo sin keyword).
//  - SEM_CONFIRM: si casa keyword, exige al menos esta cercanía semántica
//    (así "sts" solo vale si el artículo ADEMÁS trata de agentes de voz).
const SEM_HIGH = 0.84
const SEM_CONFIRM = 0.8
// e5 comprime las similitudes en un rango alto: misma historia ~0.95,
// mismo tema/otra historia ~0.90, sin relación ~0.85. Calibrado a 0.92 para
// agrupar solo la MISMA historia (ver docs/REQUISITOS.md §9).
const SIM_THRESHOLD = 0.92
const TRACTION_MIN_SOURCES = 2 // nº de fuentes para que un cluster "merezca" alerta
const THROTTLE_TOPIC = '30 minutes' // máx 1 alerta por tema en esta ventana
const DEDUPE_CLUSTER = '24 hours' // no repetir alerta de la misma historia

// --- Utilidades de dedup ---
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
  return createHash('sha1').update(title.toLowerCase().replace(/\s+/g, ' ').trim()).digest('hex')
}

// --- Match de temas por palabra completa (a prueba de transpilación) ---
const TOKEN_SPLIT = /[^\p{L}\p{N}]+/u

type TopicRow = {
  id: number
  slug: string
  label: string
  keywords: string[]
  kind: 'curated' | 'custom'
  owner_profile_id: string | null
}

function matchTopics(article: RawArticle, topics: TopicRow[]): TopicRow[] {
  const hayLower = `${article.title} ${article.summary ?? ''}`.toLowerCase()
  const tokens = new Set(hayLower.split(TOKEN_SPLIT).filter(Boolean))
  return topics.filter((t) =>
    t.keywords.some((raw) => {
      const k = raw.trim().toLowerCase()
      if (!k) return false
      return k.includes(' ') ? hayLower.includes(k) : tokens.has(k)
    }),
  )
}

export type IngestResult = {
  sources: number
  fetched: number
  inserted: number
  embedded: number
  clusters_touched: number
  notifications: number
  errors: { source: string; error: string }[]
  cached?: boolean // true si la búsqueda se sirvió de caché (sin llamada externa)
  articleIds?: number[] // IDs de artículos resueltos por esta búsqueda
}

// Artículo recién insertado que pasa por el pipeline.
type NewArticle = {
  id: number
  title: string
  summary: string | null
  url: string
  lang: string
  matches: TopicRow[]
  embedding?: number[]
  clusterId?: number | null
}

export async function runIngest(): Promise<IngestResult> {
  const result: IngestResult = {
    sources: 0,
    fetched: 0,
    inserted: 0,
    embedded: 0,
    clusters_touched: 0,
    notifications: 0,
    errors: [],
  }

  const { rows: sources } = await query<SourceRow>(
    `SELECT id, kind, name, url, lang, config FROM sources WHERE active = true`,
  )
  await ensureTopicEmbeddings()
  const topics = await loadTopics()
  result.sources = sources.length

  for (const source of sources) {
    try {
      const articles = await connectors[source.kind](source)
      result.fetched += articles.length
      await processArticles(source.id, articles, topics, result, true)
      await query(`UPDATE sources SET last_fetch = NOW() WHERE id = $1`, [source.id])
    } catch (err) {
      result.errors.push({ source: source.name, error: (err as Error).message })
    }
  }

  // Enriquecer con imagen (og:image) los artículos recientes sin ella.
  try {
    await enrichRecentImages(40)
  } catch {
    /* best-effort */
  }

  return result
}

// Crea/obtiene una fuente (inactiva) para atribuir artículos de búsqueda.
async function ensureSource(
  kind: 'rss' | 'newsapi',
  name: string,
  url: string,
  lang: string,
): Promise<number> {
  const r = await query<{ id: number }>(
    `INSERT INTO sources (kind, name, url, lang, active)
     VALUES ($1,$2,$3,$4,false)
     ON CONFLICT (kind, url) DO UPDATE SET lang = EXCLUDED.lang
     RETURNING id`,
    [kind, name, url, lang],
  )
  return r.rows[0].id
}

export function emptyResult(): IngestResult {
  return {
    sources: 0,
    fetched: 0,
    inserted: 0,
    embedded: 0,
    clusters_touched: 0,
    notifications: 0,
    errors: [],
  }
}

export async function loadTopics(): Promise<TopicRow[]> {
  const { rows } = await query<TopicRow>(
    `SELECT id, slug, label, keywords, kind, owner_profile_id FROM topics`,
  )
  return rows
}

// Pipeline por lote: insertar (dedup) → embeddings → clustering → match → notificar.
// `notify=false` para búsquedas manuales (no queremos alertar de resultados pedidos).
export async function processArticles(
  sourceId: number,
  articles: RawArticle[],
  topics: TopicRow[],
  result: IngestResult,
  notify = true,
): Promise<void> {
  // 1) Insertar artículos nuevos (deduplicados)
  const fresh: NewArticle[] = []
  for (const a of articles) {
    const ins = await query<{ id: number }>(
      `INSERT INTO articles (source_id, url, url_canonical, title, title_hash, summary, image_url, lang, published_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [
        sourceId,
        a.url,
        canonicalUrl(a.url),
        a.title,
        titleHash(a.title),
        a.summary ?? null,
        a.imageUrl ?? null,
        a.lang,
        a.publishedAt ?? null,
      ],
    )
    if (ins.rows.length === 0) continue
    result.inserted++
    fresh.push({
      id: ins.rows[0].id,
      title: a.title,
      summary: a.summary ?? null,
      url: a.url,
      lang: a.lang,
      matches: matchTopics(a, topics),
    })
  }

  // 2) Embeddings en lote (best-effort)
  if (embedEnabled() && fresh.length > 0) {
    for (let i = 0; i < fresh.length; i += 32) {
      const batch = fresh.slice(i, i + 32)
      const vecs = await embedTexts(batch.map((b) => `${b.title}. ${b.summary ?? ''}`))
      if (!vecs) break
      for (let j = 0; j < batch.length; j++) {
        const emb = vecs[j]
        if (!emb) continue
        batch[j].embedding = emb
        await query(`UPDATE articles SET embedding = $1::vector WHERE id = $2`, [
          toVector(emb),
          batch[j].id,
        ])
        result.embedded++
      }
    }
  }

  // 3) Clustering + match (keyword + semántico) + (opcional) notificaciones
  const topicById = new Map(topics.map((t) => [t.id, t]))
  for (const art of fresh) {
    if (art.embedding) {
      art.clusterId = await assignCluster(art)
      if (art.clusterId) {
        await query(`UPDATE articles SET cluster_id = $1 WHERE id = $2`, [art.clusterId, art.id])
        await refreshCluster(art.clusterId)
        result.clusters_touched++
      }
    }

    // Asignación combinada: semántica fuerte por sí sola, O keyword confirmada
    // por semántica. Sin embedding (servicio caído) → keyword sola (degradado).
    const matchedIds = new Map<number, TopicRow>()
    if (art.embedding) {
      const kwIds = new Set(art.matches.map((m) => m.id))
      const sims = await query<{ id: number; sim: number }>(
        `SELECT id, 1 - (embedding <=> $1::vector) AS sim FROM topics WHERE embedding IS NOT NULL`,
        [toVector(art.embedding)],
      )
      for (const r of sims.rows) {
        const sim = Number(r.sim)
        const t = topicById.get(r.id)
        if (!t) continue
        if (sim >= SEM_HIGH || (kwIds.has(t.id) && sim >= SEM_CONFIRM)) {
          matchedIds.set(t.id, t)
        }
      }
    } else {
      for (const t of art.matches) matchedIds.set(t.id, t)
    }

    for (const topic of matchedIds.values()) {
      await query(
        `INSERT INTO article_topics (article_id, topic_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [art.id, topic.id],
      )
      if (notify) await notifyProfiles(art, topic, result)
    }
    if (notify && matchedIds.size > 0) {
      publish({
        type: 'article',
        title: art.title,
        url: art.url,
        topic: matchedIds.values().next().value?.slug,
        at: new Date().toISOString(),
      })
    }
  }
}

// Búsqueda activa de contenidos por keywords vía Google News RSS — gratis, sin
// clave y con amplia cobertura multilingüe. Caché compartida 6h por (lang, query)
// para no martillear la fuente.
export async function searchNews(queryStr: string, lang: string): Promise<IngestResult> {
  const result = emptyResult()
  const q = queryStr.trim()
  if (!q) return result

  const provider = 'search'
  const norm = q.toLowerCase().slice(0, 300)

  const cached = await query<{ article_ids: number[] }>(
    `SELECT article_ids FROM search_cache
     WHERE provider = $1 AND lang = $2 AND query_norm = $3 AND fetched_at > now() - interval '6 hours'`,
    [provider, lang, norm],
  )
  // Solo se considera hit si hay IDs cacheados (ignora entradas antiguas vacías).
  if (cached.rowCount && cached.rowCount > 0 && (cached.rows[0].article_ids?.length ?? 0) > 0) {
    result.cached = true
    result.articleIds = cached.rows[0].article_ids
    return result
  }

  const topics = await loadTopics()
  let articleIds: number[] = []
  try {
    const articles = await googleNewsSearch(q, lang)
    if (articles.length > 0) {
      const sid = await ensureSource(
        'rss',
        'Google News (búsqueda)',
        'https://news.google.com/rss/search',
        lang,
      )
      result.fetched += articles.length
      await processArticles(sid, articles, topics, result, false)
      // Resolver los IDs de los artículos de ESTA búsqueda (nuevos o ya existentes).
      const urls = articles.map((a) => canonicalUrl(a.url))
      const idRows = await query<{ id: number }>(
        `SELECT id FROM articles WHERE url_canonical = ANY($1::text[])`,
        [urls],
      )
      articleIds = idRows.rows.map((r) => r.id)
    }
  } catch (err) {
    result.errors.push({ source: 'google-news', error: (err as Error).message })
  }

  result.sources = 1
  result.articleIds = articleIds
  try {
    await enrichRecentImages(20)
  } catch {
    /* best-effort */
  }

  await query(
    `INSERT INTO search_cache (provider, lang, query_norm, article_ids) VALUES ($1,$2,$3,$4)
     ON CONFLICT (provider, lang, query_norm) DO UPDATE SET fetched_at = now(), article_ids = $4`,
    [provider, lang, norm, articleIds],
  )
  return result
}

// Asigna el artículo al cluster más cercano dentro de la ventana, o crea uno nuevo.
async function assignCluster(art: NewArticle): Promise<number> {
  const vec = toVector(art.embedding as number[])
  const { rows } = await query<{ id: number; sim: number }>(
    `SELECT id, 1 - (centroid <=> $1::vector) AS sim
     FROM clusters
     WHERE last_seen > now() - interval '${CLUSTER_WINDOW}'
     ORDER BY centroid <=> $1::vector
     LIMIT 1`,
    [vec],
  )
  if (rows[0] && rows[0].sim >= SIM_THRESHOLD) return rows[0].id

  const ins = await query<{ id: number }>(
    `INSERT INTO clusters (label, centroid, lang, size, source_count)
     VALUES ($1, $2::vector, $3, 1, 1) RETURNING id`,
    [art.title.slice(0, 200), vec, art.lang],
  )
  return ins.rows[0].id
}

// Recalcula centroide (media de embeddings), tamaño, nº de fuentes y score de tendencia.
async function refreshCluster(clusterId: number): Promise<void> {
  await query(
    `UPDATE clusters c SET
       centroid = sub.avg_vec,
       size = sub.size,
       source_count = sub.sources,
       last_seen = now(),
       score_trend = sub.recent
     FROM (
       SELECT AVG(embedding) AS avg_vec,
              count(*) AS size,
              count(DISTINCT source_id) AS sources,
              count(*) FILTER (WHERE COALESCE(published_at, ingested_at) > now() - interval '${CLUSTER_WINDOW}') AS recent
       FROM articles WHERE cluster_id = $1 AND embedding IS NOT NULL
     ) sub
     WHERE c.id = $1`,
    [clusterId],
  )
}

// Notifica a los perfiles correspondientes con tracción + throttle + dedupe.
async function notifyProfiles(art: NewArticle, topic: TopicRow, result: IngestResult) {
  // Sin cluster no podemos evaluar tracción → no enviamos push (evita ruido si embed caído).
  if (!art.clusterId) return

  const { rows: cl } = await query<{ source_count: number }>(
    `SELECT source_count FROM clusters WHERE id = $1`,
    [art.clusterId],
  )
  if (!cl[0] || cl[0].source_count < TRACTION_MIN_SOURCES) return

  // Perfiles destino: dueño (custom) o seguidores (curated).
  let profileIds: string[] = []
  if (topic.kind === 'custom') {
    if (topic.owner_profile_id) profileIds = [topic.owner_profile_id]
  } else {
    const { rows } = await query<{ profile_id: string }>(
      `SELECT profile_id FROM profile_topics WHERE topic_id = $1`,
      [topic.id],
    )
    profileIds = rows.map((r) => r.profile_id)
  }

  for (const pid of profileIds) {
    const recent = await query(
      `SELECT 1 FROM notification_throttle
       WHERE profile_id = $1 AND (
         (topic_id = $2 AND last_notified > now() - interval '${THROTTLE_TOPIC}') OR
         (cluster_id = $3 AND last_notified > now() - interval '${DEDUPE_CLUSTER}')
       ) LIMIT 1`,
      [pid, topic.id, art.clusterId],
    )
    if (recent.rowCount && recent.rowCount > 0) continue

    await query(
      `INSERT INTO notifications (profile_id, article_id, topic_id, cluster_id, title, body)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [pid, art.id, topic.id, art.clusterId, art.title, `${topic.label} · ${hostOf(art.url)}`],
    )
    await query(
      `INSERT INTO notification_throttle (profile_id, topic_id, cluster_id, last_notified)
       VALUES ($1,$2,$3,now())
       ON CONFLICT (profile_id, topic_id, cluster_id) DO UPDATE SET last_notified = now()`,
      [pid, topic.id, art.clusterId],
    )
    result.notifications++

    const { rows: subs } = await query<{
      id: number
      endpoint: string
      p256dh: string
      auth: string
    }>(`SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE profile_id = $1`, [pid])
    for (const s of subs) {
      const sub: PushSub = { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }
      const r = await sendPush(sub, { title: art.title, body: topic.label, url: art.url })
      if (r.gone) await query(`DELETE FROM push_subscriptions WHERE id = $1`, [s.id])
    }
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return ''
  }
}
