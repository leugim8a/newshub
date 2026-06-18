import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getProfileId } from '@/lib/profile'

export const dynamic = 'force-dynamic'

// GET /api/feed
//   ?topic=ia     → un tema concreto
//   ?all=1        → todo el flujo (sin filtrar)
//   (por defecto) → temas que sigue el perfil
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const topic = searchParams.get('topic')
  const all = searchParams.get('all') === '1'
  const limit = Math.min(Number(searchParams.get('limit')) || 50, 100)

  const params: unknown[] = []
  let where = ''

  if (topic) {
    params.push(topic)
    where = `WHERE a.id IN (
      SELECT at.article_id FROM article_topics at
      JOIN topics t ON t.id = at.topic_id WHERE t.slug = $1
    )`
  } else if (!all) {
    const profileId = await getProfileId()
    if (profileId) {
      params.push(profileId)
      where = `WHERE a.id IN (
        SELECT at.article_id FROM article_topics at
        JOIN profile_topics pt ON pt.topic_id = at.topic_id
        WHERE pt.profile_id = $1
      )`
    }
  }

  params.push(limit)
  const { rows } = await query(
    `SELECT a.id, a.url, a.title, a.summary, a.image_url, a.lang, a.cluster_id,
            COALESCE(a.published_at, a.ingested_at) AS published_at,
            s.name AS source_name,
            COALESCE(array_agg(DISTINCT t.slug) FILTER (WHERE t.slug IS NOT NULL), '{}') AS topics
     FROM articles a
     LEFT JOIN sources s ON s.id = a.source_id
     LEFT JOIN article_topics at ON at.article_id = a.id
     LEFT JOIN topics t ON t.id = at.topic_id
     ${where}
     GROUP BY a.id, s.name
     ORDER BY COALESCE(a.published_at, a.ingested_at) DESC
     LIMIT $${params.length}`,
    params,
  )

  return NextResponse.json({ articles: rows })
}
