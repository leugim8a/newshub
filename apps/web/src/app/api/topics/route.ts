import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { backfillTopic } from '@/lib/backfill'
import { storeTopicEmbedding } from '@/lib/topic-vector'
import { PROFILE_COOKIE, cookieOptions, createProfile, getProfileId } from '@/lib/profile'

export const dynamic = 'force-dynamic'

function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita diacríticos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

async function resolveProfile(): Promise<{ id: string; isNew: boolean }> {
  const existing = await getProfileId()
  if (existing) return { id: existing, isNew: false }
  return { id: await createProfile(), isNew: true }
}

function withCookie(res: NextResponse, id: string, isNew: boolean) {
  if (isNew) res.cookies.set(PROFILE_COOKIE, id, cookieOptions)
  return res
}

// GET — categorías curadas + temas propios del perfil, con estado de seguimiento.
export async function GET() {
  const { id, isNew } = await resolveProfile()
  const { rows } = await query(
    `SELECT t.slug, t.label, t.kind, t.lang, t.keywords, t.topic_group,
            (pt.profile_id IS NOT NULL) AS followed,
            count(at.article_id) AS article_count
     FROM topics t
     LEFT JOIN profile_topics pt ON pt.topic_id = t.id AND pt.profile_id = $1
     LEFT JOIN article_topics at ON at.topic_id = t.id
     WHERE t.kind = 'curated' OR t.owner_profile_id = $1
     GROUP BY t.id, pt.profile_id
     ORDER BY t.kind, t.label`,
    [id],
  )
  return withCookie(NextResponse.json({ topics: rows }), id, isNew)
}

function cleanGroup(g: unknown): string | null {
  const s = typeof g === 'string' ? g.trim().slice(0, 60) : ''
  return s.length > 0 ? s : null
}

// POST — crea un tema propio. { label, keywords: string[], group?: string }
export async function POST(req: Request) {
  const { id, isNew } = await resolveProfile()
  const body = (await req.json()) as { label?: string; keywords?: string[]; group?: string }
  const label = (body.label ?? '').trim()
  const keywords = (body.keywords ?? []).map((k) => k.trim().toLowerCase()).filter(Boolean)
  const group = cleanGroup(body.group)
  if (!label || keywords.length === 0) {
    return withCookie(
      NextResponse.json({ error: 'label y keywords requeridos' }, { status: 400 }),
      id,
      isNew,
    )
  }
  const slug = slugify(label) || `tema-${Date.now()}`
  const ins = await query<{ id: number }>(
    `INSERT INTO topics (slug, label, kind, lang, keywords, owner_profile_id, topic_group)
     VALUES ($1,$2,'custom','es',$3,$4,$5)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [slug, label, keywords, id, group],
  )
  let matched = 0
  if (ins.rows.length > 0) {
    await query(`INSERT INTO profile_topics (profile_id, topic_id) VALUES ($1,$2)`, [
      id,
      ins.rows[0].id,
    ])
    // Vector del tema (para matching semántico en la ingesta).
    await storeTopicEmbedding(ins.rows[0].id, label, keywords)
    // Backfill: enlazar el tema nuevo con artículos ya ingeridos (últimos 14 días)
    // para que el feed no aparezca vacío. El match de la ingesta solo corre hacia delante.
    matched = await backfillTopic(ins.rows[0].id, keywords)
  }
  return withCookie(NextResponse.json({ ok: true, slug, matched }), id, isNew)
}

// PUT — editar un tema propio. { slug, label?, keywords?, group? }
export async function PUT(req: Request) {
  const { id, isNew } = await resolveProfile()
  const body = (await req.json()) as {
    slug?: string
    label?: string
    keywords?: string[]
    group?: string | null
  }
  if (!body.slug) {
    return withCookie(NextResponse.json({ error: 'slug requerido' }, { status: 400 }), id, isNew)
  }
  const { rows } = await query<{ id: number }>(
    `SELECT id FROM topics WHERE slug = $1 AND kind = 'custom' AND owner_profile_id = $2`,
    [body.slug, id],
  )
  if (rows.length === 0) {
    return withCookie(NextResponse.json({ error: 'tema no encontrado' }, { status: 404 }), id, isNew)
  }
  const topicId = rows[0].id
  const label = body.label?.trim()
  const keywords =
    body.keywords?.map((k) => k.trim().toLowerCase()).filter(Boolean) ?? undefined
  const hasGroup = Object.hasOwn(body, 'group')

  await query(
    `UPDATE topics SET
       label = COALESCE($2, label),
       keywords = COALESCE($3, keywords),
       topic_group = CASE WHEN $4 THEN $5 ELSE topic_group END
     WHERE id = $1`,
    [
      topicId,
      label && label.length > 0 ? label : null,
      keywords && keywords.length > 0 ? keywords : null,
      hasGroup,
      hasGroup ? cleanGroup(body.group) : null,
    ],
  )

  // Recalcular el vector del tema y re-enlazar por keywords.
  const { rows: cur } = await query<{ label: string; keywords: string[] }>(
    `SELECT label, keywords FROM topics WHERE id = $1`,
    [topicId],
  )
  if (cur[0]) await storeTopicEmbedding(topicId, cur[0].label, cur[0].keywords)
  let matched = 0
  if (keywords && keywords.length > 0) {
    matched = await backfillTopic(topicId, keywords, 30)
  }
  return withCookie(NextResponse.json({ ok: true, matched }), id, isNew)
}

// PATCH — seguir / dejar de seguir. { slug, followed }
export async function PATCH(req: Request) {
  const { id, isNew } = await resolveProfile()
  const body = (await req.json()) as { slug?: string; followed?: boolean }
  if (!body.slug || typeof body.followed !== 'boolean') {
    return withCookie(NextResponse.json({ error: 'slug y followed' }, { status: 400 }), id, isNew)
  }
  const { rows } = await query<{ id: number }>(
    `SELECT id FROM topics WHERE slug = $1 AND (kind = 'curated' OR owner_profile_id = $2)`,
    [body.slug, id],
  )
  if (rows.length === 0) {
    return withCookie(NextResponse.json({ error: 'tema no encontrado' }, { status: 404 }), id, isNew)
  }
  if (body.followed) {
    await query(
      `INSERT INTO profile_topics (profile_id, topic_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [id, rows[0].id],
    )
  } else {
    await query(`DELETE FROM profile_topics WHERE profile_id = $1 AND topic_id = $2`, [
      id,
      rows[0].id,
    ])
  }
  return withCookie(NextResponse.json({ ok: true }), id, isNew)
}

// DELETE — borra un tema propio. { slug }
export async function DELETE(req: Request) {
  const { id, isNew } = await resolveProfile()
  const body = (await req.json()) as { slug?: string }
  if (!body.slug) {
    return withCookie(NextResponse.json({ error: 'slug requerido' }, { status: 400 }), id, isNew)
  }
  await query(`DELETE FROM topics WHERE slug = $1 AND kind = 'custom' AND owner_profile_id = $2`, [
    body.slug,
    id,
  ])
  return withCookie(NextResponse.json({ ok: true }), id, isNew)
}
