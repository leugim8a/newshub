import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET /api/objectivity/scores
//   ?source=<texto>  → últimas puntuaciones de las fuentes que casen (con motivo).
//   ?cluster=<id>    → desglose de TODAS las fuentes de esa historia (comparativa).
// Transparencia: deja ver POR QUÉ la IA puntuó cada cobertura.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const source = searchParams.get('source')
  const cluster = Number(searchParams.get('cluster'))

  const titleSub = `(SELECT a.title FROM articles a
        WHERE a.cluster_id = os.cluster_id AND a.source_id = os.source_id
        ORDER BY COALESCE(a.published_at, a.ingested_at) DESC LIMIT 1)`
  const urlSub = `(SELECT a.url FROM articles a
        WHERE a.cluster_id = os.cluster_id AND a.source_id = os.source_id
        ORDER BY COALESCE(a.published_at, a.ingested_at) DESC LIMIT 1)`

  if (cluster) {
    const { rows } = await query(
      `SELECT os.cluster_id, s.name AS source, os.score, os.reason,
              ${titleSub} AS title, ${urlSub} AS url
         FROM objectivity_scores os JOIN sources s ON s.id = os.source_id
        WHERE os.cluster_id = $1
        ORDER BY os.score DESC`,
      [cluster],
    )
    return NextResponse.json({ cluster, scores: rows })
  }

  const { rows } = await query(
    `SELECT os.cluster_id, s.name AS source, os.score, os.reason, os.created_at,
            ${titleSub} AS title, ${urlSub} AS url
       FROM objectivity_scores os JOIN sources s ON s.id = os.source_id
      WHERE s.name ILIKE $1
      ORDER BY os.created_at DESC
      LIMIT 15`,
    [`%${source ?? 'El País'}%`],
  )
  return NextResponse.json({ scores: rows })
}
