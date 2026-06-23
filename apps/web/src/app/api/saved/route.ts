import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { PROFILE_COOKIE, cookieOptions, createProfile, getProfileId } from '@/lib/profile'

export const dynamic = 'force-dynamic'

async function resolve() {
  const id = await getProfileId()
  if (id) return { id, isNew: false }
  return { id: await createProfile(), isNew: true }
}
function withCookie(res: NextResponse, id: string, isNew: boolean) {
  if (isNew) res.cookies.set(PROFILE_COOKIE, id, cookieOptions)
  return res
}

// GET — artículos guardados (formato feed).
export async function GET() {
  const { id, isNew } = await resolve()
  const { rows } = await query(
    `SELECT a.id, a.url, a.title, a.summary, a.image_url, a.lang, a.cluster_id,
            COALESCE(a.published_at, a.ingested_at) AS published_at,
            s.name AS source_name,
            c.size AS cluster_size, c.source_count AS cluster_sources,
            COALESCE(array_agg(DISTINCT t.slug) FILTER (WHERE t.slug IS NOT NULL), '{}') AS topics,
            true AS saved
     FROM saved_articles sa
     JOIN articles a ON a.id = sa.article_id
     LEFT JOIN sources s ON s.id = a.source_id
     LEFT JOIN clusters c ON c.id = a.cluster_id
     LEFT JOIN article_topics at ON at.article_id = a.id
     LEFT JOIN topics t ON t.id = at.topic_id
     WHERE sa.profile_id = $1
     GROUP BY a.id, s.name, c.size, c.source_count, sa.created_at
     ORDER BY sa.created_at DESC
     LIMIT 100`,
    [id],
  )
  return withCookie(NextResponse.json({ articles: rows }), id, isNew)
}

// POST { articleId } — guardar.
export async function POST(req: Request) {
  const { id, isNew } = await resolve()
  const { articleId } = (await req.json()) as { articleId?: number }
  if (!articleId) return withCookie(NextResponse.json({ error: 'articleId' }, { status: 400 }), id, isNew)
  await query(
    `INSERT INTO saved_articles (profile_id, article_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
    [id, articleId],
  )
  return withCookie(NextResponse.json({ ok: true }), id, isNew)
}

// DELETE { articleId } — quitar.
export async function DELETE(req: Request) {
  const { id, isNew } = await resolve()
  const { articleId } = (await req.json()) as { articleId?: number }
  if (!articleId) return withCookie(NextResponse.json({ error: 'articleId' }, { status: 400 }), id, isNew)
  await query(`DELETE FROM saved_articles WHERE profile_id = $1 AND article_id = $2`, [id, articleId])
  return withCookie(NextResponse.json({ ok: true }), id, isNew)
}
