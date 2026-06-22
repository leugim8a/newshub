import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET /api/trends — clusters (historias) más cubiertos en la ventana móvil.
//   ?window=12   horas de la ventana (6/12/24)
//   ?min=2       tamaño mínimo de cluster
//   ?topic=ia    solo historias con artículos de ese tema
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const window = Math.min(Math.max(Number(searchParams.get('window')) || 12, 1), 72)
  const min = Math.min(Math.max(Number(searchParams.get('min')) || 2, 1), 10)
  const topic = searchParams.get('topic')

  const params: unknown[] = [min]
  let topicJoin = ''
  if (topic) {
    params.push(topic)
    topicJoin = `AND c.id IN (
      SELECT a.cluster_id FROM articles a
      JOIN article_topics at ON at.article_id = a.id
      JOIN topics t ON t.id = at.topic_id
      WHERE t.slug = $${params.length} AND a.cluster_id IS NOT NULL
    )`
  }

  const { rows } = await query(
    `SELECT c.id, c.label, c.size, c.source_count, c.score_trend, c.lang,
            c.first_seen, c.last_seen,
            top.title AS top_title, top.url AS top_url, top.image_url AS top_image,
            top.source_name
     FROM clusters c
     LEFT JOIN LATERAL (
       SELECT a.title, a.url, a.image_url, s.name AS source_name
       FROM articles a
       LEFT JOIN sources s ON s.id = a.source_id
       WHERE a.cluster_id = c.id
       ORDER BY COALESCE(a.published_at, a.ingested_at) DESC
       LIMIT 1
     ) top ON true
     WHERE c.last_seen > now() - interval '${window} hours' AND c.size >= $1
     ${topicJoin}
     ORDER BY c.size DESC, c.source_count DESC, c.score_trend DESC
     LIMIT 30`,
    params,
  )
  return NextResponse.json({ trends: rows })
}
