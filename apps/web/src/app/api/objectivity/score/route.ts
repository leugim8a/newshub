import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { llmEnabled } from '@/lib/llm'
import { extractText } from '@/lib/extract'
import { scoreClusterObjectivity, type Coverage } from '@/lib/objectivity'

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
    // Una cobertura por fuente (la más reciente) para comparar.
    const { rows: covs } = await query<Coverage & { url: string }>(
      `SELECT DISTINCT ON (a.source_id)
              a.source_id AS "sourceId", s.name AS source, a.title, a.summary, a.url
         FROM articles a JOIN sources s ON s.id = a.source_id
        WHERE a.cluster_id = $1
        ORDER BY a.source_id, COALESCE(a.published_at, a.ingested_at) DESC`,
      [c.id],
    )
    if (covs.length < 2) {
      await query(`UPDATE clusters SET objectivity_scored_at = now() WHERE id = $1`, [c.id])
      continue
    }

    // Texto completo (reader) de cada cobertura, en paralelo. Si falla, se usa el summary.
    const withBody = await Promise.all(
      covs.map(async (cov) => ({ ...cov, body: await extractText(cov.url).catch(() => null) })),
    )

    const result = await scoreClusterObjectivity(withBody, c.lang === 'en' ? 'en' : 'es')
    if (result) {
      for (const r of result) {
        await query(
          `INSERT INTO objectivity_scores (cluster_id, source_id, score, reason)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (cluster_id, source_id)
           DO UPDATE SET score = EXCLUDED.score, reason = EXCLUDED.reason`,
          [c.id, r.sourceId, r.score, r.reason],
        )
        scored++
      }
    }
    await query(`UPDATE clusters SET objectivity_scored_at = now() WHERE id = $1`, [c.id])
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
