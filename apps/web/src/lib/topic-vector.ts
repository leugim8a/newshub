import { query } from '@/lib/db'
import { embedTexts, toVector } from '@/lib/embed'

// Calcula y guarda el vector de un tema (representación 'query' de e5).
export async function storeTopicEmbedding(
  topicId: number,
  label: string,
  keywords: string[],
): Promise<void> {
  const v = await embedTexts([`${label}. ${keywords.join(', ')}`], 'query')
  if (v?.[0]) {
    await query(`UPDATE topics SET embedding = $1::vector WHERE id = $2`, [toVector(v[0]), topicId])
  }
}

// Rellena los vectores de los temas que aún no lo tienen (idempotente, barato).
export async function ensureTopicEmbeddings(): Promise<void> {
  const { rows } = await query<{ id: number; label: string; keywords: string[] }>(
    `SELECT id, label, keywords FROM topics WHERE embedding IS NULL`,
  )
  for (const t of rows) {
    await storeTopicEmbedding(t.id, t.label, t.keywords)
  }
}
