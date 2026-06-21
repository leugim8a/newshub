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
    // Distribución de los enlaces ACTUALES por franja de similitud: muestra qué
    // se quitaría al subir el umbral de confirmación.
    const bands = await query(
      `WITH linked AS (
         SELECT 1 - (a.embedding <=> t.embedding) AS sim
         FROM article_topics at
         JOIN articles a ON a.id=at.article_id
         JOIN topics t ON t.id=at.topic_id
         WHERE a.embedding IS NOT NULL AND t.embedding IS NOT NULL)
       SELECT
         count(*) FILTER (WHERE sim >= 0.80 AND sim < 0.82)::int AS b_80_82,
         count(*) FILTER (WHERE sim >= 0.82 AND sim < 0.84)::int AS b_82_84,
         count(*) FILTER (WHERE sim >= 0.84 AND sim < 0.86)::int AS b_84_86,
         count(*) FILTER (WHERE sim >= 0.86)::int AS b_86_plus,
         count(*)::int AS total
       FROM linked`,
    )
    // Muestra de lo que está JUSTO en cada franja baja (lo que se perdería al subir).
    const sampleBand = (lo: number, hi: number) =>
      query(
        `SELECT round((1 - (a.embedding <=> t.embedding))::numeric,3) AS sim, t.slug, left(a.title,52) AS title
         FROM article_topics at JOIN articles a ON a.id=at.article_id JOIN topics t ON t.id=at.topic_id
         WHERE a.embedding IS NOT NULL AND t.embedding IS NOT NULL
           AND 1 - (a.embedding <=> t.embedding) >= $1 AND 1 - (a.embedding <=> t.embedding) < $2
         ORDER BY random() LIMIT 12`,
        [lo, hi],
      )
    const s80 = await sampleBand(0.8, 0.82)
    const s82 = await sampleBand(0.82, 0.84)
    return NextResponse.json({
      mode: 'analysis',
      candidate_pairs: counts.rows,
      linked_by_band: bands.rows[0],
      sample_0_80_82: s80.rows,
      sample_0_82_84: s82.rows,
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
