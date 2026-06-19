import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { encryptSecret } from '@/lib/crypto'
import { PROFILE_COOKIE, cookieOptions, createProfile, getProfileId } from '@/lib/profile'

export const dynamic = 'force-dynamic'

async function resolve(): Promise<{ id: string; isNew: boolean }> {
  const existing = await getProfileId()
  if (existing) return { id: existing, isNew: false }
  return { id: await createProfile(), isNew: true }
}

function withCookie(res: NextResponse, id: string, isNew: boolean) {
  if (isNew) res.cookies.set(PROFILE_COOKIE, id, cookieOptions)
  return res
}

// POST { key } — guarda la clave GNews propia (cifrada en reposo).
export async function POST(req: Request) {
  const { id, isNew } = await resolve()
  const body = (await req.json()) as { key?: string }
  const key = (body.key ?? '').trim()
  if (!key) return withCookie(NextResponse.json({ error: 'key requerida' }, { status: 400 }), id, isNew)
  await query(`UPDATE profiles SET gnews_key = $2 WHERE id = $1`, [id, encryptSecret(key)])
  return withCookie(NextResponse.json({ ok: true, hasGnewsKey: true }), id, isNew)
}

// DELETE — elimina la clave propia.
export async function DELETE() {
  const { id, isNew } = await resolve()
  await query(`UPDATE profiles SET gnews_key = NULL WHERE id = $1`, [id])
  return withCookie(NextResponse.json({ ok: true, hasGnewsKey: false }), id, isNew)
}
