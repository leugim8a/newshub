import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { backfillTopic } from '@/lib/backfill'
import { embedTexts, toVector } from '@/lib/embed'
import { searchNews } from '@/ingest'
import { PROFILE_COOKIE, cookieOptions, createProfile, getProfileId } from '@/lib/profile'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const SEARCH_LIMIT_PER_HOUR = 30
const RELEVANCE_THRESHOLD = 0.86 // sim coseno query(tema)↔passage(artículo); calibrado
const SEARCH_SOURCE_URL = 'https://news.google.com/rss/search'

// Query focal para Google News: nombre del tema + frases (entre comillas) y
// palabras de ≥4 letras. Descarta acrónimos cortos ambiguos (p.ej. "sts").
function buildQuery(label: string, keywords: string[]): string {
  const phrases = keywords.filter((k) => k.includes(' '))
  const words = keywords.filter((k) => !k.includes(' ') && k.length >= 4)
  const parts = [
    `"${label}"`,
    ...phrases.map((p) => `"${p}"`),
    ...words,
  ]
  return [...new Set(parts)].slice(0, 6).join(' OR ')
}

export async function POST(req: Request) {
  let profileId = await getProfileId()
  const isNew = !profileId
  if (!profileId) profileId = await createProfile()

  const body = (await req.json()) as { slug?: string }
  if (!body.slug) return NextResponse.json({ error: 'slug requerido' }, { status: 400 })

  // Rate-limit por perfil (ventana móvil de 1h).
  const tr = await query<{ count: number }>(
    `INSERT INTO search_throttle (profile_id, window_start, count) VALUES ($1, now(), 1)
     ON CONFLICT (profile_id) DO UPDATE SET
       count = CASE WHEN search_throttle.window_start < now() - interval '1 hour'
                    THEN 1 ELSE search_throttle.count + 1 END,
       window_start = CASE WHEN search_throttle.window_start < now() - interval '1 hour'
                           THEN now() ELSE search_throttle.window_start END
     RETURNING count`,
    [profileId],
  )
  if ((tr.rows[0]?.count ?? 0) > SEARCH_LIMIT_PER_HOUR) {
    const res = NextResponse.json({ error: 'rate_limited' }, { status: 429 })
    if (isNew) res.cookies.set(PROFILE_COOKIE, profileId, cookieOptions)
    return res
  }

  const { rows } = await query<{ id: number; label: string; keywords: string[]; lang: string }>(
    `SELECT id, label, keywords, lang FROM topics
     WHERE slug = $1 AND (kind = 'curated' OR owner_profile_id = $2)`,
    [body.slug, profileId],
  )
  if (rows.length === 0) return NextResponse.json({ error: 'tema no encontrado' }, { status: 404 })
  const topic = rows[0]

  // 1) Buscar en internet (Google News) con query focal.
  const search = await searchNews(buildQuery(topic.label, topic.keywords), topic.lang)

  // 2) Filtro semántico: enlazar al tema solo los resultados de búsqueda
  //    realmente cercanos (rechaza homónimos como "STS" Ship-to-Ship).
  const topicVecs = await embedTexts([`${topic.label}: ${topic.keywords.join(', ')}`], 'query')
  let relevant: number | null = null
  if (topicVecs?.[0]) {
    const tv = toVector(topicVecs[0])
    // Reconstruir desde cero los enlaces del tema con artículos de búsqueda.
    await query(
      `DELETE FROM article_topics at USING articles a, sources s
       WHERE at.topic_id = $1 AND at.article_id = a.id AND a.source_id = s.id
         AND s.url = $2`,
      [topic.id, SEARCH_SOURCE_URL],
    )
    const ins = await query(
      `INSERT INTO article_topics (article_id, topic_id)
       SELECT a.id, $1 FROM articles a JOIN sources s ON s.id = a.source_id
       WHERE s.url = $2 AND a.ingested_at > now() - interval '6 hours'
         AND a.embedding IS NOT NULL
         AND 1 - (a.embedding <=> $3::vector) >= $4
       ON CONFLICT DO NOTHING`,
      [topic.id, SEARCH_SOURCE_URL, tv, RELEVANCE_THRESHOLD],
    )
    relevant = ins.rowCount ?? 0
  } else {
    // Sin embeddings: caer al enlace por keywords (menos preciso).
    await backfillTopic(topic.id, topic.keywords, 30)
  }

  const { rows: cnt } = await query<{ total: number }>(
    `SELECT count(*)::int AS total FROM article_topics WHERE topic_id = $1`,
    [topic.id],
  )

  const res = NextResponse.json({
    provider: 'search',
    cached: Boolean(search.cached),
    fetched: search.fetched,
    relevant,
    total: cnt[0]?.total ?? 0,
  })
  if (isNew) res.cookies.set(PROFILE_COOKIE, profileId, cookieOptions)
  return res
}
