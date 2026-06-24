import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { llmEnabled } from '@/lib/llm'
import { scoreAndStoreCluster } from '@/lib/score-cluster'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

// Puntúa la objetividad (comparativa, IA) de los clusters de ≥2 fuentes aún sin
// valorar. Disparado por el cron de Coolify; protegido con Bearer $INGEST_TOKEN.
async function run(limit = 5, force = false): Promise<{ scored: number; clusters: number }> {
  if (!llmEnabled()) return { scored: 0, clusters: 0 }

  const { rows: clusters } = await query<{ id: number; lang: string }>(
    `SELECT c.id, c.lang FROM clusters c
      WHERE c.source_count >= 2
        ${force ? '' : 'AND c.objectivity_scored_at IS NULL'}
        AND EXISTS (
          SELECT 1 FROM articles a WHERE a.cluster_id = c.id
            AND COALESCE(a.published_at, a.ingested_at) > now() - interval '7 days'
        )
      ORDER BY c.source_count DESC, c.id DESC
      LIMIT $1`,
    [limit],
  )

  let scored = 0
  for (const c of clusters) {
    const result = await scoreAndStoreCluster(c.id, c.lang === 'en' ? 'en' : 'es')
    scored += result.length
  }
  return { scored, clusters: clusters.length }
}

export async function POST(req: Request) {
  const token = process.env.INGEST_TOKEN
  const auth = req.headers.get('authorization')
  if (token && auth !== `Bearer ${token}`)
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const force = new URL(req.url).searchParams.get('force') === '1'
  return NextResponse.json(await run(5, force))
}

export async function GET(req: Request) {
  const token = process.env.INGEST_TOKEN
  const url = new URL(req.url)
  if (token && url.searchParams.get('token') !== token)
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const force = url.searchParams.get('force') === '1'
  return NextResponse.json(await run(5, force))
}
