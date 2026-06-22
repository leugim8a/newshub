import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { backfillTopic } from '@/lib/backfill'
import { storeTopicEmbedding } from '@/lib/topic-vector'
import { PROFILE_COOKIE, cookieOptions, createProfile, getProfileId } from '@/lib/profile'
import { PRESETS, getPreset } from '@/lib/presets'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

// GET — lista de perfiles disponibles.
export async function GET() {
  return NextResponse.json({
    presets: PRESETS.map((p) => ({ id: p.id, name: p.name, description: p.description })),
  })
}

// POST { id } — aplica un perfil al perfil anónimo actual.
export async function POST(req: Request) {
  let profileId = await getProfileId()
  const isNew = !profileId
  if (!profileId) profileId = await createProfile()

  const body = (await req.json()) as { id?: string }
  const preset = body.id ? getPreset(body.id) : undefined
  if (!preset) return NextResponse.json({ error: 'perfil no encontrado' }, { status: 404 })

  // 1) Categorías curadas: dejar de seguir todas y seguir las del perfil.
  await query(
    `DELETE FROM profile_topics WHERE profile_id = $1
       AND topic_id IN (SELECT id FROM topics WHERE kind = 'curated')`,
    [profileId],
  )
  if (preset.curated.length > 0) {
    await query(
      `INSERT INTO profile_topics (profile_id, topic_id)
       SELECT $1, id FROM topics WHERE kind = 'curated' AND slug = ANY($2)
       ON CONFLICT DO NOTHING`,
      [profileId, preset.curated],
    )
  }

  // 2) Temas propios: crear (con sección), seguir, vectorizar y enlazar.
  let topicsCreated = 0
  for (const tp of preset.topics) {
    const slug = slugify(tp.label) || `tema-${Date.now()}`
    const ins = await query<{ id: number }>(
      `INSERT INTO topics (slug, label, kind, lang, keywords, owner_profile_id, topic_group)
       VALUES ($1,$2,'custom','es',$3,$4,$5)
       ON CONFLICT DO NOTHING RETURNING id`,
      [slug, tp.label, tp.keywords, profileId, tp.group ?? null],
    )
    let topicId = ins.rows[0]?.id
    if (!topicId) {
      const ex = await query<{ id: number }>(
        `SELECT id FROM topics WHERE slug = $1 AND owner_profile_id = $2`,
        [slug, profileId],
      )
      topicId = ex.rows[0]?.id
    } else {
      topicsCreated++
    }
    if (!topicId) continue
    await query(
      `INSERT INTO profile_topics (profile_id, topic_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [profileId, topicId],
    )
    await storeTopicEmbedding(topicId, tp.label, tp.keywords)
    await backfillTopic(topicId, tp.keywords, 30)
  }

  // 3) Fuentes: añadir (globales) y activar.
  let sourcesAdded = 0
  for (const s of preset.sources) {
    const r = await query(
      `INSERT INTO sources (kind, name, url, lang, active, config)
       VALUES ($1,$2,$3,$4,true,$5)
       ON CONFLICT (kind, url) DO UPDATE SET active = true, name = EXCLUDED.name`,
      [s.kind, s.name, s.url, s.lang, JSON.stringify(s.config ?? {})],
    )
    sourcesAdded += r.rowCount ?? 0
  }

  // 4) Preferencias de UI (fusionadas).
  await query(`UPDATE profiles SET prefs = prefs || $2::jsonb WHERE id = $1`, [
    profileId,
    JSON.stringify(preset.prefs),
  ])

  const res = NextResponse.json({
    ok: true,
    preset: preset.id,
    topicsCreated,
    sourcesAdded,
    curated: preset.curated.length,
  })
  if (isNew) res.cookies.set(PROFILE_COOKIE, profileId, cookieOptions)
  return res
}
