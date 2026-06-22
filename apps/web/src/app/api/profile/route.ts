import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { PROFILE_COOKIE, cookieOptions, createProfile, getProfileId } from '@/lib/profile'

export const dynamic = 'force-dynamic'

// GET /api/profile — garantiza que existe un perfil anónimo y lo devuelve.
export async function GET() {
  let id = await getProfileId()
  if (!id) id = await createProfile()
  await query(`UPDATE profiles SET last_seen = now() WHERE id = $1`, [id])

  const { rows } = await query<{ slug: string }>(
    `SELECT t.slug FROM profile_topics pt JOIN topics t ON t.id = pt.topic_id WHERE pt.profile_id = $1`,
    [id],
  )
  const { rows: pk } = await query<{ has: boolean; prefs: Record<string, unknown> }>(
    `SELECT (gnews_key IS NOT NULL) AS has, prefs FROM profiles WHERE id = $1`,
    [id],
  )

  const res = NextResponse.json({
    id,
    followed: rows.map((r) => r.slug),
    hasGnewsKey: pk[0]?.has ?? false,
    prefs: pk[0]?.prefs ?? {},
  })
  res.cookies.set(PROFILE_COOKIE, id, cookieOptions)
  return res
}

// POST /api/profile — guarda las preferencias de UI del perfil. { prefs }
export async function POST(req: Request) {
  let id = await getProfileId()
  const isNew = !id
  if (!id) id = await createProfile()
  const body = (await req.json()) as { prefs?: Record<string, unknown> }
  // Fusiona (no reemplaza) para no pisar prefs de otras partes de la UI.
  await query(`UPDATE profiles SET prefs = prefs || $2::jsonb WHERE id = $1`, [
    id,
    JSON.stringify(body.prefs ?? {}),
  ])
  const res = NextResponse.json({ ok: true })
  if (isNew) res.cookies.set(PROFILE_COOKIE, id, cookieOptions)
  return res
}
