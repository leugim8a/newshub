import { query } from '@/lib/db'

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Enlaza un tema con los artículos recientes que casan sus keywords (palabra
// completa para una sola palabra; subcadena para frases). Devuelve nº de matches.
// El match de la ingesta solo corre hacia delante; esto rellena hacia atrás.
export async function backfillTopic(
  topicId: number,
  keywords: string[],
  days = 14,
): Promise<number> {
  const conds: string[] = []
  const params: unknown[] = [topicId]
  for (const raw of keywords) {
    const k = raw.trim().toLowerCase()
    if (!k) continue
    params.push(k.includes(' ') ? `%${k}%` : `\\y${escapeRegex(k)}\\y`)
    const op = k.includes(' ') ? 'ILIKE' : '~*'
    conds.push(`(a.title || ' ' || coalesce(a.summary,'')) ${op} $${params.length}`)
  }
  if (conds.length === 0) return 0
  const res = await query(
    `INSERT INTO article_topics (article_id, topic_id)
     SELECT a.id, $1 FROM articles a
     WHERE a.ingested_at > now() - interval '${days} days' AND (${conds.join(' OR ')})
     ON CONFLICT DO NOTHING`,
    params,
  )
  return res.rowCount ?? 0
}
