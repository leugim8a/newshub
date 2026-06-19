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
  const { rows: pk } = await query<{ has: boolean }>(
    `SELECT (gnews_key IS NOT NULL) AS has FROM profiles WHERE id = $1`,
    [id],
  )

  const res = NextResponse.json({
    id,
    followed: rows.map((r) => r.slug),
    hasGnewsKey: pk[0]?.has ?? false,
  })
  res.cookies.set(PROFILE_COOKIE, id, cookieOptions)
  return res
}
