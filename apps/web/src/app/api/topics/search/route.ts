import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { backfillTopic } from '@/lib/backfill'
import { decryptSecret } from '@/lib/crypto'
import { searchNews } from '@/ingest'
import { PROFILE_COOKIE, cookieOptions, createProfile, getProfileId } from '@/lib/profile'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const SEARCH_LIMIT_PER_HOUR = 30

// POST /api/topics/search { slug }
// Busca contenidos para un tema: GNews (clave propia BYOK o de la app, con caché
// compartida 6h) + enlace de artículos ya ingeridos. Rate-limit por perfil.
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
    const res = NextResponse.json(
      { error: 'rate_limited', limit: SEARCH_LIMIT_PER_HOUR },
      { status: 429 },
    )
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

  // Clave propia del usuario (BYOK), si la configuró.
  const { rows: pk } = await query<{ gnews_key: string | null }>(
    `SELECT gnews_key FROM profiles WHERE id = $1`,
    [profileId],
  )
  const userKey = decryptSecret(pk[0]?.gnews_key ?? null) || undefined

  const queryStr = topic.keywords
    .slice(0, 8)
    .map((k) => (k.includes(' ') ? `"${k}"` : k))
    .join(' OR ')

  const hasKey = Boolean(userKey || process.env.NEWSAPI_KEY)
  const provider = hasKey ? process.env.NEWSAPI_PROVIDER || 'gnews' : 'none'
  const search = await searchNews(queryStr, topic.lang, { apiKey: userKey })
  const linked = await backfillTopic(topic.id, topic.keywords, 30)

  const { rows: cnt } = await query<{ total: number }>(
    `SELECT count(*)::int AS total FROM article_topics WHERE topic_id = $1`,
    [topic.id],
  )

  const res = NextResponse.json({
    provider,
    usedOwnKey: Boolean(userKey),
    cached: Boolean(search.cached),
    fetched: search.fetched,
    newArticles: search.inserted,
    linked,
    total: cnt[0]?.total ?? 0,
  })
  if (isNew) res.cookies.set(PROFILE_COOKIE, profileId, cookieOptions)
  return res
}
