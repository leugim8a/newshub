import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { embedTexts, toVector } from '@/lib/embed'
import { topicVectorText } from '@/lib/topic-vector'
import { searchNews } from '@/ingest'
import { PROFILE_COOKIE, cookieOptions, createProfile, getProfileId } from '@/lib/profile'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const SEARCH_LIMIT_PER_HOUR = 30
// Corte de relevancia ADAPTATIVO: se queda con el grupo de mejores resultados
// (dentro de REL_MARGIN del mejor) y nunca por debajo de REL_FLOOR. Evita tanto
// los falsos positivos (outliers lejos del mejor) como dejar el tema vacío.
const REL_FLOOR = 0.78
const REL_MARGIN = 0.05
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
  const ids = search.articleIds ?? []
  const topicVecs = await embedTexts([topicVectorText(topic.label, topic.keywords)], 'query')
  let relevant: number | null = null

  // Reconstruir desde cero los enlaces del tema con artículos de búsqueda.
  await query(
    `DELETE FROM article_topics at USING articles a, sources s
     WHERE at.topic_id = $1 AND at.article_id = a.id AND a.source_id = s.id
       AND s.url = $2`,
    [topic.id, SEARCH_SOURCE_URL],
  )

  if (topicVecs?.[0] && ids.length > 0) {
    const tv = toVector(topicVecs[0])
    // Similitud SOLO de los resultados de ESTA búsqueda con el vector del tema.
    const cand = await query<{ id: number; sim: number }>(
      `SELECT a.id, 1 - (a.embedding <=> $1::vector) AS sim
       FROM articles a
       WHERE a.id = ANY($2::bigint[]) AND a.embedding IS NOT NULL
       ORDER BY sim DESC`,
      [tv, ids],
    )
    const keep: number[] = []
    if (cand.rows.length > 0) {
      const best = Number(cand.rows[0].sim)
      const cutoff = Math.max(REL_FLOOR, best - REL_MARGIN)
      for (const r of cand.rows) if (Number(r.sim) >= cutoff) keep.push(r.id)
      if (keep.length > 0) {
        await query(
          `INSERT INTO article_topics (article_id, topic_id)
           SELECT unnest($1::bigint[]), $2 ON CONFLICT DO NOTHING`,
          [keep, topic.id],
        )
      }
    }
    relevant = keep.length
  } else if (ids.length > 0) {
    // Sin embeddings: enlazar todos los resultados de esta búsqueda.
    await query(
      `INSERT INTO article_topics (article_id, topic_id)
       SELECT unnest($1::bigint[]), $2 ON CONFLICT DO NOTHING`,
      [ids, topic.id],
    )
    relevant = ids.length
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
