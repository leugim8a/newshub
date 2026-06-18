import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { PROFILE_COOKIE, cookieOptions, createProfile, getProfileId } from '@/lib/profile'

export const dynamic = 'force-dynamic'

// POST /api/push/subscribe  { subscription }
// La suscripción se liga al perfil anónimo (las alertas se enrutan por sus temas).
export async function POST(req: Request) {
  const body = (await req.json()) as {
    subscription?: { endpoint: string; keys: { p256dh: string; auth: string } }
  }
  const sub = body.subscription
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return NextResponse.json({ error: 'suscripción inválida' }, { status: 400 })
  }

  let id = await getProfileId()
  const isNew = !id
  if (!id) id = await createProfile()

  await query(
    `INSERT INTO push_subscriptions (endpoint, p256dh, auth, profile_id)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (endpoint) DO UPDATE SET profile_id = EXCLUDED.profile_id`,
    [sub.endpoint, sub.keys.p256dh, sub.keys.auth, id],
  )

  const res = NextResponse.json({ ok: true })
  if (isNew) res.cookies.set(PROFILE_COOKIE, id, cookieOptions)
  return res
}

// DELETE /api/push/subscribe  { endpoint }
export async function DELETE(req: Request) {
  const body = (await req.json()) as { endpoint?: string }
  if (!body.endpoint) return NextResponse.json({ error: 'endpoint requerido' }, { status: 400 })
  await query(`DELETE FROM push_subscriptions WHERE endpoint = $1`, [body.endpoint])
  return NextResponse.json({ ok: true })
}
