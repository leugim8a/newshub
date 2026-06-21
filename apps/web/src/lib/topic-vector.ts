import { query } from '@/lib/db'
import { embedTexts, toVector } from '@/lib/embed'

// Texto representativo del SIGNIFICADO del tema para el vector: nombre + frases +
// palabras de ≥4 letras. Descarta acrónimos cortos ambiguos (p.ej. "sts", "btc")
// para que el vector NO se contamine con su otro sentido (Ship-to-Ship, etc.).
// Esos acrónimos siguen en keywords para el match léxico, pero confirmado por
// semántica (ver SEM_CONFIRM en la ingesta).
export function topicVectorText(label: string, keywords: string[]): string {
  const phrases = keywords.filter((k) => k.includes(' '))
  const words = keywords.filter((k) => !k.includes(' ') && k.length >= 4)
  return [label, ...phrases, ...words].join('. ')
}

// Calcula y guarda el vector de un tema (representación 'query' de e5).
export async function storeTopicEmbedding(
  topicId: number,
  label: string,
  keywords: string[],
): Promise<void> {
  const v = await embedTexts([topicVectorText(label, keywords)], 'query')
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
