import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { channelFeed, resolveChannelId } from '@/lib/youtube'

export const dynamic = 'force-dynamic'
export const maxDuration = 180

type Creator = { name: string; handle: string; lang: 'es' | 'en' }

// Divulgadores de IA de referencia. El handle se resuelve a channel_id real; los que
// no resuelvan se reportan y se omiten (handles corregibles luego).
const CREATORS: Creator[] = [
  // Español
  { name: 'Dot CSV', handle: 'DotCSV', lang: 'es' },
  { name: 'Xavier Mitjana', handle: 'XavierMitjana', lang: 'es' },
  { name: 'Marc Vidal', handle: 'marcvidal', lang: 'es' },
  { name: 'Nate Gentile', handle: 'NateGentile7', lang: 'es' },
  { name: 'Gustavo Entrala', handle: 'gustavoentrala', lang: 'es' },
  { name: 'Platzi', handle: 'Platzi', lang: 'es' },
  // Inglés
  { name: 'Two Minute Papers', handle: 'TwoMinutePapers', lang: 'en' },
  { name: 'Yannic Kilcher', handle: 'YannicKilcher', lang: 'en' },
  { name: 'AI Explained', handle: 'aiexplained-official', lang: 'en' },
  { name: 'Matt Wolfe', handle: 'mreflow', lang: 'en' },
  { name: 'bycloud', handle: 'bycloudAI', lang: 'en' },
  { name: 'sentdex', handle: 'sentdex', lang: 'en' },
  { name: 'Andrej Karpathy', handle: 'AndrejKarpathy', lang: 'en' },
  { name: '3Blue1Brown', handle: '3blue1brown', lang: 'en' },
  { name: 'Lex Fridman', handle: 'lexfridman', lang: 'en' },
  { name: 'Fireship', handle: 'Fireship', lang: 'en' },
  { name: 'The AI Advantage', handle: 'aiadvantage', lang: 'en' },
]

function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

async function run(creators: Creator[]) {
  const created: string[] = []
  const updated: string[] = []
  const failed: { name: string; handle: string }[] = []

  for (const c of creators) {
    const channelId = await resolveChannelId(c.handle)
    if (!channelId) {
      failed.push({ name: c.name, handle: c.handle })
      continue
    }
    const feed = channelFeed(channelId)
    const slug = slugify(c.name)

    // Tema (curado, grupo 'divulgadores').
    const existing = await query<{ id: number }>(
      `SELECT id FROM topics WHERE slug = $1 AND kind = 'curated'`,
      [slug],
    )
    let topicId: number
    if (existing.rows.length > 0) {
      topicId = existing.rows[0].id
      // Sin embedding: identidad por canal/nombre, no por semántica (evita que se le
      // cuelgue todo el contenido genérico de IA).
      await query(
        `UPDATE topics SET topic_group = 'divulgadores', embedding = NULL WHERE id = $1`,
        [topicId],
      )
    } else {
      const ins = await query<{ id: number }>(
        `INSERT INTO topics (slug, label, kind, lang, keywords, topic_group)
         VALUES ($1,$2,'curated',$3,$4,'divulgadores') RETURNING id`,
        [slug, c.name, c.lang, [c.name]],
      )
      topicId = ins.rows[0].id
    }

    // Fuente: canal de YouTube ligado al tema.
    const src = await query<{ inserted: boolean }>(
      `INSERT INTO sources (kind, name, url, lang, active, topic_id)
       VALUES ('rss', $1, $2, $3, true, $4)
       ON CONFLICT (kind, url) DO UPDATE SET active = true, topic_id = EXCLUDED.topic_id, name = EXCLUDED.name
       RETURNING (xmax = 0) AS inserted`,
      [`YouTube · ${c.name}`, feed, c.lang, topicId],
    )
    if (src.rows[0]?.inserted) created.push(c.name)
    else updated.push(c.name)

    // Reconciliar etiquetas: SOLO vídeos de su canal + artículos que mencionan su
    // nombre. Borra cualquier etiqueta semántica cruzada previa.
    await query(`DELETE FROM article_topics WHERE topic_id = $1`, [topicId])
    await query(
      `INSERT INTO article_topics (article_id, topic_id)
         SELECT a.id, $1 FROM articles a JOIN sources s ON s.id = a.source_id
          WHERE s.topic_id = $1
       ON CONFLICT DO NOTHING`,
      [topicId],
    )
    await query(
      `INSERT INTO article_topics (article_id, topic_id)
         SELECT a.id, $1 FROM articles a WHERE a.title ILIKE '%' || $2 || '%'
       ON CONFLICT DO NOTHING`,
      [topicId, c.name],
    )
  }

  return { created, updated, failed }
}

export async function POST(req: Request) {
  const token = process.env.INGEST_TOKEN
  const auth = req.headers.get('authorization')
  if (token && auth !== `Bearer ${token}`)
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  let creators = CREATORS
  try {
    const body = (await req.json()) as { creators?: Creator[] }
    if (Array.isArray(body.creators) && body.creators.length > 0) creators = body.creators
  } catch {
    /* sin body → lista por defecto */
  }
  return NextResponse.json(await run(creators))
}
