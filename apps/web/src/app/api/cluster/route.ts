import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { llmEnabled, summarizeCluster } from '@/lib/llm'

export const dynamic = 'force-dynamic'
export const maxDuration = 40

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
    title: string
    url: string
    summary: string | null
    image_url: string | null
    published_at: string
    source_name: string | null
  }>(
    `SELECT a.id, a.title, a.url, a.summary, a.image_url,
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

  return NextResponse.json({
    cluster: { id: cluster.id, label: cluster.label, size: cluster.size, source_count: cluster.source_count },
    summary,
    bullets: bullets ?? [],
    articles,
  })
}
