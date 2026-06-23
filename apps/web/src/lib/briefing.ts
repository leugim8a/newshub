import { query } from '@/lib/db'
import { llmEnabled, summarizeCluster } from '@/lib/llm'

export type BriefingItem = {
  cluster_id: number
  title: string
  url: string
  image_url: string | null
  published_at: string
  source_count: number
  source_names: (string | null)[]
  summary: string | null
  bullets: string[]
}

// Reúne las historias con más cobertura de las últimas ~36h y, si falta, genera
// (y cachea) un resumen IA por historia. Usado por /api/briefing y el email digest.
export async function buildBriefing(limit = 8): Promise<BriefingItem[]> {
  const { rows: clusters } = await query<{
    id: number
    label: string
    size: number
    source_count: number
    lang: string
    summary: string | null
    bullets: string[] | null
  }>(
    `SELECT c.id, c.label, c.size, c.source_count, c.lang, c.summary, c.bullets
       FROM clusters c
      WHERE c.source_count >= 2
        AND EXISTS (
          SELECT 1 FROM articles a
           WHERE a.cluster_id = c.id
             AND COALESCE(a.published_at, a.ingested_at) > now() - interval '36 hours'
        )
      ORDER BY c.source_count DESC, c.size DESC, c.id DESC
      LIMIT $1`,
    [limit],
  )

  const items: BriefingItem[] = []
  for (const c of clusters) {
    const { rows: arts } = await query<{
      id: number
      title: string
      url: string
      image_url: string | null
      published_at: string
      source_name: string | null
    }>(
      `SELECT a.id, a.title, a.url, a.image_url,
              COALESCE(a.published_at, a.ingested_at) AS published_at,
              s.name AS source_name
         FROM articles a LEFT JOIN sources s ON s.id = a.source_id
        WHERE a.cluster_id = $1
        ORDER BY COALESCE(a.published_at, a.ingested_at) DESC`,
      [c.id],
    )
    if (arts.length === 0) continue

    let summary = c.summary
    let bullets = c.bullets
    if (!summary && llmEnabled() && arts.length >= 2) {
      const gen = await summarizeCluster(
        arts[0].title,
        arts.map((a) => ({ title: a.title, summary: null, source: a.source_name })),
        c.lang === 'en' ? 'en' : 'es',
      )
      if (gen) {
        summary = gen.summary
        bullets = gen.bullets
        await query(
          `UPDATE clusters SET summary = $2, bullets = $3, summarized_at = now() WHERE id = $1`,
          [c.id, summary, JSON.stringify(bullets)],
        )
      }
    }

    items.push({
      cluster_id: c.id,
      title: arts[0].title,
      url: arts[0].url,
      image_url: arts.find((a) => a.image_url)?.image_url ?? null,
      published_at: arts[0].published_at,
      source_count: c.source_count,
      source_names: arts.map((a) => a.source_name),
      summary,
      bullets: bullets ?? [],
    })
  }
  return items
}
