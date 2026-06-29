import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Liga las fuentes generalistas a un tema "Actualidad" (grupo 'actualidad') para que
// TODA su producción cuente como actualidad, sin depender de que el titular case con
// keywords de politica/internacional/economia (que dejaba media sección vacía).
const PATTERNS = [
  'el país',
  'el mundo',
  '20minutos',
  'eldiario',
  'vanguardia',
  'abc —',
  'confidencial',
  'europa press',
  'bbc',
  'guardian',
  'expansión',
  'expansion',
]

export async function POST(req: Request) {
  const token = process.env.INGEST_TOKEN
  const auth = req.headers.get('authorization')
  if (token && auth !== `Bearer ${token}`)
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // Tema "Actualidad" (sin embedding: se identifica por fuente ligada, no por semántica).
  const ex = await query<{ id: number }>(
    `SELECT id FROM topics WHERE slug = 'actualidad' AND kind = 'curated'`,
  )
  let topicId: number
  if (ex.rows.length > 0) {
    topicId = ex.rows[0].id
    await query(`UPDATE topics SET topic_group = 'actualidad', embedding = NULL WHERE id = $1`, [topicId])
  } else {
    const ins = await query<{ id: number }>(
      `INSERT INTO topics (slug, label, kind, lang, keywords, topic_group)
       VALUES ('actualidad','Actualidad','curated','es', ARRAY['actualidad'], 'actualidad') RETURNING id`,
    )
    topicId = ins.rows[0].id
  }

  // Ligar las fuentes generalistas que aún no tengan tema (no pisa los canales de
  // divulgadores, que ya tienen su topic_id).
  const cond = PATTERNS.map((_, i) => `name ILIKE $${i + 2}`).join(' OR ')
  const upd = await query(
    `UPDATE sources SET topic_id = $1
      WHERE topic_id IS NULL AND url NOT LIKE '%youtube.com%' AND (${cond})
      RETURNING name`,
    [topicId, ...PATTERNS.map((p) => `%${p}%`)],
  )

  // Etiquetar sus artículos ya existentes.
  const tag = await query(
    `INSERT INTO article_topics (article_id, topic_id)
       SELECT a.id, $1 FROM articles a JOIN sources s ON s.id = a.source_id
        WHERE s.topic_id = $1
     ON CONFLICT DO NOTHING`,
    [topicId],
  )

  return NextResponse.json({
    topicId,
    bound: upd.rows.map((r) => (r as { name: string }).name),
    tagged: tag.rowCount,
  })
}
