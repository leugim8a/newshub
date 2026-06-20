import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { ensureTopicEmbeddings } from '@/lib/topic-vector'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const SEM_TOPIC_THRESHOLD = 0.86
const WINDOW_DAYS = 60

// Mantenimiento: re-etiqueta semánticamente las noticias YA guardadas. Enlaza
// cada artículo con los temas cuyo vector está cerca del suyo (≥ umbral), en una
// sola pasada con pgvector. Protegido con INGEST_TOKEN.
async function run(req: Request): Promise<Response> {
  const token = process.env.INGEST_TOKEN
  const auth = req.headers.get('authorization')
  const url = new URL(req.url)
  const ok = !token || auth === `Bearer ${token}` || url.searchParams.get('token') === token
  if (!ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // Asegurar que los temas tienen vector.
  await ensureTopicEmbeddings()

  const started = Date.now()
  const res = await query(
    `INSERT INTO article_topics (article_id, topic_id)
     SELECT a.id, t.id
     FROM articles a
     CROSS JOIN topics t
     WHERE a.embedding IS NOT NULL
       AND t.embedding IS NOT NULL
       AND a.ingested_at > now() - interval '${WINDOW_DAYS} days'
       AND 1 - (a.embedding <=> t.embedding) >= $1
     ON CONFLICT DO NOTHING`,
    [SEM_TOPIC_THRESHOLD],
  )

  // Diagnóstico para entender el resultado.
  const diag = await query<{
    topics_total: number
    topics_vec: number
    arts_vec: number
    pairs_over: number
  }>(
    `SELECT
       (SELECT count(*) FROM topics)::int AS topics_total,
       (SELECT count(*) FROM topics WHERE embedding IS NOT NULL)::int AS topics_vec,
       (SELECT count(*) FROM articles WHERE embedding IS NOT NULL
          AND ingested_at > now() - interval '${WINDOW_DAYS} days')::int AS arts_vec,
       (SELECT count(*) FROM articles a CROSS JOIN topics t
          WHERE a.embedding IS NOT NULL AND t.embedding IS NOT NULL
            AND a.ingested_at > now() - interval '${WINDOW_DAYS} days'
            AND 1 - (a.embedding <=> t.embedding) >= $1)::int AS pairs_over`,
    [SEM_TOPIC_THRESHOLD],
  )

  return NextResponse.json({
    linked: res.rowCount ?? 0,
    ms: Date.now() - started,
    diag: diag.rows[0],
  })
}

export async function POST(req: Request) {
  return run(req)
}
export async function GET(req: Request) {
  return run(req)
}
