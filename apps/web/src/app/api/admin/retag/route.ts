import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { ensureTopicEmbeddings } from '@/lib/topic-vector'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const SEM_HIGH = 0.84 // semántica fuerte basta
const SEM_CONFIRM = 0.8 // mínimo para que un enlace sea válido
const WINDOW = '60 days'

// Mantenimiento del etiquetado semántico de noticias ya guardadas.
//   GET/POST                 → análisis (no modifica nada)
//   ?apply=1                 → enlaza semántica fuerte (≥SEM_HIGH)
//   ?apply=1&cleanup=1       → además elimina enlaces sin respaldo semántico (<SEM_CONFIRM)
async function run(req: Request): Promise<Response> {
  const token = process.env.INGEST_TOKEN
  const url = new URL(req.url)
  const ok =
    !token ||
    req.headers.get('authorization') === `Bearer ${token}` ||
    url.searchParams.get('token') === token
  if (!ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  await ensureTopicEmbeddings()

  if (url.searchParams.get('apply') !== '1') {
    const counts = await query(
      `SELECT thr,
        (SELECT count(*) FROM articles a CROSS JOIN topics t
         WHERE a.embedding IS NOT NULL AND t.embedding IS NOT NULL
           AND a.ingested_at > now() - interval '${WINDOW}'
           AND 1 - (a.embedding <=> t.embedding) >= thr)::int AS pairs
       FROM unnest(ARRAY[0.80,0.82,0.84,0.86]::float8[]) AS thr`,
    )
    // Enlaces existentes SIN respaldo semántico (candidatos a limpieza).
    const weak = await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM article_topics at
       JOIN articles a ON a.id = at.article_id
       JOIN topics t ON t.id = at.topic_id
       WHERE a.embedding IS NOT NULL AND t.embedding IS NOT NULL
         AND 1 - (a.embedding <=> t.embedding) < $1`,
      [SEM_CONFIRM],
    )
    const weakSample = await query(
      `SELECT round((1 - (a.embedding <=> t.embedding))::numeric,3) AS sim, t.slug, left(a.title,55) AS title
       FROM article_topics at JOIN articles a ON a.id=at.article_id JOIN topics t ON t.id=at.topic_id
       WHERE a.embedding IS NOT NULL AND t.embedding IS NOT NULL
         AND 1 - (a.embedding <=> t.embedding) < $1
       ORDER BY sim ASC LIMIT 20`,
      [SEM_CONFIRM],
    )
    return NextResponse.json({
      mode: 'analysis',
      counts: counts.rows,
      weak_links: weak.rows[0]?.n ?? 0,
      weak_sample: weakSample.rows,
    })
  }

  const started = Date.now()
  // Enlazar semántica fuerte (vectores ya limpios).
  const ins = await query(
    `INSERT INTO article_topics (article_id, topic_id)
     SELECT a.id, t.id FROM articles a CROSS JOIN topics t
     WHERE a.embedding IS NOT NULL AND t.embedding IS NOT NULL
       AND a.ingested_at > now() - interval '${WINDOW}'
       AND 1 - (a.embedding <=> t.embedding) >= $1
     ON CONFLICT DO NOTHING`,
    [SEM_HIGH],
  )

  let cleaned = 0
  if (url.searchParams.get('cleanup') === '1') {
    // Eliminar enlaces sin respaldo semántico (incluye falsos positivos por
    // keyword ambigua: "sts" en un artículo de barcos no roza el tema de voz).
    const del = await query(
      `DELETE FROM article_topics at
       USING articles a, topics t
       WHERE at.article_id = a.id AND at.topic_id = t.id
         AND a.embedding IS NOT NULL AND t.embedding IS NOT NULL
         AND 1 - (a.embedding <=> t.embedding) < $1`,
      [SEM_CONFIRM],
    )
    cleaned = del.rowCount ?? 0
  }

  return NextResponse.json({ applied: true, linked: ins.rowCount ?? 0, cleaned, ms: Date.now() - started })
}

export const POST = run
export const GET = run
