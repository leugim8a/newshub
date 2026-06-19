import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { backfillTopic } from '@/lib/backfill'
import { searchNews } from '@/ingest'
import { PROFILE_COOKIE, cookieOptions, createProfile, getProfileId } from '@/lib/profile'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// POST /api/topics/search { slug }
// Busca contenidos para un tema: trae artículos por sus keywords (GNews, si hay
// clave) y enlaza los artículos ya ingeridos que casen. Devuelve contadores.
export async function POST(req: Request) {
  let profileId = await getProfileId()
  const isNew = !profileId
  if (!profileId) profileId = await createProfile()

  const body = (await req.json()) as { slug?: string }
  if (!body.slug) {
    return NextResponse.json({ error: 'slug requerido' }, { status: 400 })
  }

  const { rows } = await query<{ id: number; label: string; keywords: string[]; lang: string }>(
    `SELECT id, label, keywords, lang FROM topics
     WHERE slug = $1 AND (kind = 'curated' OR owner_profile_id = $2)`,
    [body.slug, profileId],
  )
  if (rows.length === 0) {
    return NextResponse.json({ error: 'tema no encontrado' }, { status: 404 })
  }
  const topic = rows[0]

  // Consulta GNews a partir de las keywords (frases entre comillas), tope 8.
  const queryStr = topic.keywords
    .slice(0, 8)
    .map((k) => (k.includes(' ') ? `"${k}"` : k))
    .join(' OR ')

  const provider = process.env.NEWSAPI_KEY ? process.env.NEWSAPI_PROVIDER || 'gnews' : 'none'
  const search = await searchNews(queryStr, topic.lang)
  const linked = await backfillTopic(topic.id, topic.keywords, 30)

  const { rows: cnt } = await query<{ total: number }>(
    `SELECT count(*)::int AS total FROM article_topics WHERE topic_id = $1`,
    [topic.id],
  )

  const res = NextResponse.json({
    provider,
    fetched: search.fetched,
    newArticles: search.inserted,
    linked,
    total: cnt[0]?.total ?? 0,
  })
  if (isNew) res.cookies.set(PROFILE_COOKIE, profileId, cookieOptions)
  return res
}
