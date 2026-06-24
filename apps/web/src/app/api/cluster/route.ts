import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { llmEnabled, summarizeCluster } from '@/lib/llm'
import { scoreAndStoreCluster } from '@/lib/score-cluster'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// GET /api/cluster?id= — la historia: todas las fuentes que la cubren + resumen IA.
export async function GET(req: Request) {
  const id = Number(new URL(req.url).searchParams.get('id'))
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const { rows: cl } = await query<{
    id: number
    label: string
    size: number
    source_count: number
    lang: string
    summary: string | null
    bullets: string[] | null
    summarized_at: string | null
  }>(`SELECT id, label, size, source_count, lang, summary, bullets, summarized_at FROM clusters WHERE id = $1`, [id])
  if (cl.length === 0) return NextResponse.json({ error: 'no encontrado' }, { status: 404 })
  const cluster = cl[0]

  const { rows: articles } = await query<{
    id: number
    source_id: number | null
    title: string
    url: string
    summary: string | null
    image_url: string | null
    published_at: string
    source_name: string | null
  }>(
    `SELECT a.id, a.source_id, a.title, a.url, a.summary, a.image_url,
            COALESCE(a.published_at, a.ingested_at) AS published_at,
            s.name AS source_name
     FROM articles a LEFT JOIN sources s ON s.id = a.source_id
     WHERE a.cluster_id = $1
     ORDER BY COALESCE(a.published_at, a.ingested_at) DESC`,
    [id],
  )

  // Generar resumen bajo demanda si falta y hay ≥2 coberturas.
  let summary = cluster.summary
  let bullets = cluster.bullets
  if (!summary && llmEnabled() && articles.length >= 2) {
    const gen = await summarizeCluster(
      articles[0]?.title ?? cluster.label,
      articles.map((a) => ({ title: a.title, summary: a.summary, source: a.source_name })),
      cluster.lang === 'en' ? 'en' : 'es',
    )
    if (gen) {
      summary = gen.summary
      bullets = gen.bullets
      await query(
        `UPDATE clusters SET summary = $2, bullets = $3, summarized_at = now() WHERE id = $1`,
        [id, summary, JSON.stringify(bullets)],
      )
    }
  }

  // Análisis de sesgo por cobertura (IA comparativa). Si el cluster aún no se ha
  // puntuado y hay ≥2 fuentes, se puntúa bajo demanda (texto completo + Gemini).
  let { rows: scores } = await query<{ source_id: number; score: number; reason: string | null }>(
    `SELECT source_id, score, reason FROM objectivity_scores WHERE cluster_id = $1`,
    [id],
  )
  if (scores.length === 0 && llmEnabled() && cluster.source_count >= 2) {
    try {
      await scoreAndStoreCluster(id, cluster.lang === 'en' ? 'en' : 'es')
      const r = await query<{ source_id: number; score: number; reason: string | null }>(
        `SELECT source_id, score, reason FROM objectivity_scores WHERE cluster_id = $1`,
        [id],
      )
      scores = r.rows
    } catch {
      /* si falla, seguimos sin análisis */
    }
  }
  const bySource = new Map(scores.map((s) => [s.source_id, s]))

  const articlesOut = articles.map((a) => {
    const sc = a.source_id != null ? bySource.get(a.source_id) : undefined
    return {
      id: a.id,
      title: a.title,
      url: a.url,
      summary: a.summary,
      image_url: a.image_url,
      published_at: a.published_at,
      source_name: a.source_name,
      objectivity_score: sc?.score ?? null,
      objectivity_reason: sc?.reason ?? null,
    }
  })

  return NextResponse.json({
    cluster: { id: cluster.id, label: cluster.label, size: cluster.size, source_count: cluster.source_count },
    summary,
    bullets: bullets ?? [],
    articles: articlesOut,
  })
}
