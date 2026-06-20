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

  await ensureTopicEmbeddings()

  const thr = Number(url.searchParams.get('threshold'))
  const apply = url.searchParams.get('apply') === '1'

  // Modo análisis (por defecto): cuántos pares por umbral + muestra para juzgar.
  if (!apply) {
    const counts = await query(
      `SELECT thr,
        (SELECT count(*) FROM articles a CROSS JOIN topics t
         WHERE a.embedding IS NOT NULL AND t.embedding IS NOT NULL
           AND a.ingested_at > now() - interval '${WINDOW_DAYS} days'
           AND 1 - (a.embedding <=> t.embedding) >= thr)::int AS pairs
       FROM unnest(ARRAY[0.80,0.82,0.84,0.86]::float8[]) AS thr`,
    )
    const sample = await query(
      `SELECT round((1 - (a.embedding <=> t.embedding))::numeric, 3) AS sim,
              t.slug, left(a.title, 60) AS title
       FROM articles a CROSS JOIN topics t
       WHERE a.embedding IS NOT NULL AND t.embedding IS NOT NULL
         AND a.ingested_at > now() - interval '${WINDOW_DAYS} days'
         AND 1 - (a.embedding <=> t.embedding) >= 0.82
         AND NOT EXISTS (SELECT 1 FROM article_topics x WHERE x.article_id=a.id AND x.topic_id=t.id)
       ORDER BY sim DESC LIMIT 25`,
    )
    return NextResponse.json({ mode: 'analysis', counts: counts.rows, sample: sample.rows })
  }

  // Modo aplicar: enlaza al umbral indicado (?apply=1&threshold=0.83).
  const threshold = thr >= 0.7 && thr <= 0.95 ? thr : SEM_TOPIC_THRESHOLD
  const started = Date.now()
  const res = await query(
    `INSERT INTO article_topics (article_id, topic_id)
     SELECT a.id, t.id FROM articles a CROSS JOIN topics t
     WHERE a.embedding IS NOT NULL AND t.embedding IS NOT NULL
       AND a.ingested_at > now() - interval '${WINDOW_DAYS} days'
       AND 1 - (a.embedding <=> t.embedding) >= $1
     ON CONFLICT DO NOTHING`,
    [threshold],
  )
  return NextResponse.json({ applied: true, threshold, linked: res.rowCount ?? 0, ms: Date.now() - started })
}

export async function POST(req: Request) {
  return run(req)
}
export async function GET(req: Request) {
  return run(req)
}
