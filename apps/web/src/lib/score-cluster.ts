import { query } from '@/lib/db'
import { extractText } from '@/lib/extract'
import { scoreClusterObjectivity, type Coverage, type ClusterScore } from '@/lib/objectivity'

// Puntúa la objetividad (comparativa, IA) de UN cluster y persiste los resultados.
// Usa el texto completo (reader) de cada cobertura. Compartido por el cron y la
// vista de historia (bajo demanda).
export async function scoreAndStoreCluster(
  clusterId: number,
  lang: 'es' | 'en',
): Promise<ClusterScore[]> {
  const { rows: covs } = await query<Coverage & { url: string }>(
    `SELECT DISTINCT ON (a.source_id)
            a.source_id AS "sourceId", s.name AS source, a.title, a.summary, a.url
       FROM articles a JOIN sources s ON s.id = a.source_id
      WHERE a.cluster_id = $1
      ORDER BY a.source_id, COALESCE(a.published_at, a.ingested_at) DESC`,
    [clusterId],
  )
  if (covs.length < 2) {
    await query(`UPDATE clusters SET objectivity_scored_at = now() WHERE id = $1`, [clusterId])
    return []
  }

  const withBody = await Promise.all(
    covs.map(async (cov) => ({ ...cov, body: await extractText(cov.url).catch(() => null) })),
  )

  const result = await scoreClusterObjectivity(withBody, lang)
  if (result) {
    for (const r of result) {
      await query(
        `INSERT INTO objectivity_scores (cluster_id, source_id, score, reason)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (cluster_id, source_id)
         DO UPDATE SET score = EXCLUDED.score, reason = EXCLUDED.reason`,
        [clusterId, r.sourceId, r.score, r.reason],
      )
    }
  }
  await query(`UPDATE clusters SET objectivity_scored_at = now() WHERE id = $1`, [clusterId])
  return result ?? []
}
