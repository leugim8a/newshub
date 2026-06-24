import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { addBoundSource, discoverSources, normalizeSourceInput } from '@/lib/source-discovery'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

type Seed = { name: string; group: string; lang: 'es' | 'en' }

// Temas de ejemplo: la IA descubre sus fuentes (canales/RSS) y se ligan al tema.
const DEFAULT: Seed[] = [
  { name: 'Cocina', group: 'cocina', lang: 'es' },
  { name: 'Repostería', group: 'cocina', lang: 'es' },
  { name: 'Estética y belleza', group: 'estetica', lang: 'es' },
  { name: 'Mesoterapia', group: 'estetica', lang: 'es' },
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

async function run(seeds: Seed[]) {
  const report: { topic: string; added: number; sources: string[] }[] = []

  for (const s of seeds) {
    const slug = slugify(s.name)
    const existing = await query<{ id: number }>(
      `SELECT id FROM topics WHERE slug = $1 AND kind = 'curated'`,
      [slug],
    )
    let topicId: number
    if (existing.rows.length > 0) {
      topicId = existing.rows[0].id
      await query(`UPDATE topics SET topic_group = $2 WHERE id = $1`, [topicId, s.group])
    } else {
      const ins = await query<{ id: number }>(
        `INSERT INTO topics (slug, label, kind, lang, keywords, topic_group)
         VALUES ($1,$2,'curated',$3,$4,$5) RETURNING id`,
        [slug, s.name, s.lang, [s.name], s.group],
      )
      topicId = ins.rows[0].id
    }

    const suggestions = await discoverSources(s.name, s.lang)
    const added: string[] = []
    for (const sug of suggestions) {
      const ns = await normalizeSourceInput(sug.url)
      if (!ns) continue
      await addBoundSource(topicId, s.lang, ns, sug.name).catch(() => {})
      added.push(`${sug.name} (${sug.via})`)
    }
    report.push({ topic: s.name, added: added.length, sources: added })
  }
  return report
}

export async function POST(req: Request) {
  const token = process.env.INGEST_TOKEN
  const auth = req.headers.get('authorization')
  if (token && auth !== `Bearer ${token}`)
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  let seeds = DEFAULT
  try {
    const body = (await req.json()) as { topics?: Seed[] }
    if (Array.isArray(body.topics) && body.topics.length > 0) seeds = body.topics
  } catch {
    /* lista por defecto */
  }
  return NextResponse.json({ report: await run(seeds) })
}
