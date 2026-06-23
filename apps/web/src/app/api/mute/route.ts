import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { PROFILE_COOKIE, cookieOptions, createProfile, getProfileId } from '@/lib/profile'

export const dynamic = 'force-dynamic'

async function resolve() {
  const id = await getProfileId()
  if (id) return { id, isNew: false }
  return { id: await createProfile(), isNew: true }
}
function withCookie(res: NextResponse, id: string, isNew: boolean) {
  if (isNew) res.cookies.set(PROFILE_COOKIE, id, cookieOptions)
  return res
}

export async function GET() {
  const { id, isNew } = await resolve()
  const { rows } = await query(
    `SELECT id, kind, value FROM mute_filters WHERE profile_id = $1 ORDER BY created_at DESC`,
    [id],
  )
  return withCookie(NextResponse.json({ mutes: rows }), id, isNew)
}

// POST { kind, value }
export async function POST(req: Request) {
  const { id, isNew } = await resolve()
  const body = (await req.json()) as { kind?: string; value?: string }
  const kind = body.kind === 'source' ? 'source' : 'keyword'
  const value = (body.value ?? '').trim().slice(0, 80)
  if (!value) return withCookie(NextResponse.json({ error: 'value' }, { status: 400 }), id, isNew)
  await query(`INSERT INTO mute_filters (profile_id, kind, value) VALUES ($1,$2,$3)`, [id, kind, value])
  return withCookie(NextResponse.json({ ok: true }), id, isNew)
}

// DELETE { id }
export async function DELETE(req: Request) {
  const { id, isNew } = await resolve()
  const body = (await req.json()) as { id?: number }
  if (!body.id) return withCookie(NextResponse.json({ error: 'id' }, { status: 400 }), id, isNew)
  await query(`DELETE FROM mute_filters WHERE id = $1 AND profile_id = $2`, [body.id, id])
  return withCookie(NextResponse.json({ ok: true }), id, isNew)
}
