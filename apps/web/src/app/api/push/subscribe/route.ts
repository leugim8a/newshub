import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

// POST /api/push/subscribe  { subscription, topics? }
export async function POST(req: Request) {
  const body = (await req.json()) as {
    subscription?: { endpoint: string; keys: { p256dh: string; auth: string } }
    topics?: string[]
  }
  const sub = body.subscription
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return NextResponse.json({ error: 'suscripción inválida' }, { status: 400 })
  }

  await query(
    `INSERT INTO push_subscriptions (endpoint, p256dh, auth, topic_slugs)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (endpoint) DO UPDATE SET topic_slugs = EXCLUDED.topic_slugs`,
    [sub.endpoint, sub.keys.p256dh, sub.keys.auth, body.topics ?? []],
  )
  return NextResponse.json({ ok: true })
}

// DELETE /api/push/subscribe  { endpoint }
export async function DELETE(req: Request) {
  const body = (await req.json()) as { endpoint?: string }
  if (!body.endpoint) return NextResponse.json({ error: 'endpoint requerido' }, { status: 400 })
  await query(`DELETE FROM push_subscriptions WHERE endpoint = $1`, [body.endpoint])
  return NextResponse.json({ ok: true })
}
