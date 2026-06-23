import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getProfileId } from '@/lib/profile'

export const dynamic = 'force-dynamic'

// GET /api/feed
//   ?topic=ia     → un tema concreto
//   ?all=1        → todo el flujo (sin filtrar por temas)
//   (por defecto) → temas que sigue el perfil
// En todos los casos se ocultan las noticias descartadas por el perfil.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const topic = searchParams.get('topic')
  const all = searchParams.get('all') === '1'
  const limit = Math.min(Number(searchParams.get('limit')) || 50, 100)
  const profileId = await getProfileId()

  const params: unknown[] = []
  const conds: string[] = []

  if (topic) {
    params.push(topic)
    conds.push(`a.id IN (
      SELECT at.article_id FROM article_topics at
      JOIN topics t ON t.id = at.topic_id WHERE t.slug = $${params.length}
    )`)
  } else if (!all && profileId) {
    params.push(profileId)
    conds.push(`a.id IN (
      SELECT at.article_id FROM article_topics at
      JOIN profile_topics pt ON pt.topic_id = at.topic_id
      WHERE pt.profile_id = $${params.length}
    )`)
  }

  if (profileId) {
    params.push(profileId)
    conds.push(
      `a.id NOT IN (SELECT article_id FROM discarded_articles WHERE profile_id = $${params.length})`,
    )
  }

  const where = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : ''
  params.push(limit)

  // Orden con DIVERSIDAD por fuente (round-robin): primero el artículo más
  // reciente de cada fuente, luego el segundo de cada una, etc. Así los medios de
  // alto volumen no monopolizan el feed y los newsletters de bajo volumen no se
  // ahogan. Dentro de cada "ronda" se ordena por fecha.
  const { rows } = await query(
    `SELECT a.id, a.url, a.title, a.summary, a.image_url, a.lang, a.cluster_id,
            COALESCE(a.published_at, a.ingested_at) AS published_at,
            s.name AS source_name,
            c.size AS cluster_size, c.source_count AS cluster_sources,
            COALESCE(array_agg(DISTINCT t.slug) FILTER (WHERE t.slug IS NOT NULL), '{}') AS topics
     FROM articles a
     LEFT JOIN sources s ON s.id = a.source_id
     LEFT JOIN clusters c ON c.id = a.cluster_id
     LEFT JOIN article_topics at ON at.article_id = a.id
     LEFT JOIN topics t ON t.id = at.topic_id
     ${where}
     GROUP BY a.id, a.source_id, s.name, c.size, c.source_count
     ORDER BY ROW_NUMBER() OVER (
                PARTITION BY a.source_id
                ORDER BY COALESCE(a.published_at, a.ingested_at) DESC
              ),
              COALESCE(a.published_at, a.ingested_at) DESC
     LIMIT $${params.length}`,
    params,
  )

  return NextResponse.json({ articles: rows })
}
