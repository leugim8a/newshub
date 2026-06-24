import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getProfileId } from '@/lib/profile'
import { addBoundSource, discoverSources, normalizeSourceInput } from '@/lib/source-discovery'
import { llmEnabled } from '@/lib/llm'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

async function findTopic(slug: string, profileId: string | null) {
  const { rows } = await query<{ id: number; lang: string }>(
    `SELECT id, lang FROM topics
      WHERE slug = $1 AND (kind = 'curated' OR owner_profile_id = $2) LIMIT 1`,
    [slug, profileId],
  )
  return rows[0] ?? null
}

// GET ?slug= &discover=1 → sugerencias de fuentes con IA para el tema.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const slug = searchParams.get('slug')
  if (!slug) return NextResponse.json({ error: 'slug' }, { status: 400 })
  const profileId = await getProfileId()
  const topic = await findTopic(slug, profileId)
  if (!topic) return NextResponse.json({ error: 'tema no encontrado' }, { status: 404 })
  if (!llmEnabled()) return NextResponse.json({ suggestions: [] })

  const { rows: lab } = await query<{ label: string }>(`SELECT label FROM topics WHERE id = $1`, [topic.id])
  const suggestions = await discoverSources(lab[0]?.label ?? slug, topic.lang === 'en' ? 'en' : 'es')
  return NextResponse.json({ suggestions })
}

// POST { slug, url, name? } → añade una fuente (YouTube/RSS/web) ligada al tema.
export async function POST(req: Request) {
  const profileId = await getProfileId()
  const body = (await req.json()) as { slug?: string; url?: string; name?: string }
  if (!body.slug || !body.url) return NextResponse.json({ error: 'slug y url' }, { status: 400 })
  const topic = await findTopic(body.slug, profileId)
  if (!topic) return NextResponse.json({ error: 'tema no encontrado' }, { status: 404 })

  const ns = await normalizeSourceInput(body.url)
  if (!ns) {
    return NextResponse.json(
      { error: 'No pude encontrar un feed válido (canal de YouTube, RSS o web con RSS).' },
      { status: 422 },
    )
  }
  const { tagged } = await addBoundSource(topic.id, topic.lang, ns, body.name)
  return NextResponse.json({ ok: true, via: ns.via, url: ns.url, name: body.name || ns.name, tagged })
}
