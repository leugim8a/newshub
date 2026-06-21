import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET /api/trends — clusters (historias) que más crecen en la ventana móvil.
export async function GET() {
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
     WHERE c.last_seen > now() - interval '12 hours' AND c.size >= 2
     ORDER BY c.size DESC, c.source_count DESC, c.score_trend DESC
     LIMIT 30`,
  )
  return NextResponse.json({ trends: rows })
}
