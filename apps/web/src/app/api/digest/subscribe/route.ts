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

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

// GET → estado de suscripción del perfil
export async function GET() {
  const id = await getProfileId()
  if (!id) return NextResponse.json({ email: null, optin: false })
  const { rows } = await query<{ email: string | null; digest_optin: boolean }>(
    `SELECT email, digest_optin FROM profiles WHERE id = $1`,
    [id],
  )
  return NextResponse.json({ email: rows[0]?.email ?? null, optin: rows[0]?.digest_optin ?? false })
}

// POST { email, lang } → suscribe
export async function POST(req: Request) {
  const { id, isNew } = await resolve()
  const body = (await req.json()) as { email?: string; lang?: string }
  const email = (body.email ?? '').trim().toLowerCase()
  if (!EMAIL_RE.test(email))
    return withCookie(NextResponse.json({ error: 'email inválido' }, { status: 400 }), id, isNew)
  const lang = body.lang === 'en' ? 'en' : 'es'
  await query(
    `UPDATE profiles SET email = $2, digest_lang = $3, digest_optin = true WHERE id = $1`,
    [id, email, lang],
  )
  return withCookie(NextResponse.json({ ok: true, email, optin: true }), id, isNew)
}

// DELETE → baja
export async function DELETE() {
  const id = await getProfileId()
  if (id) await query(`UPDATE profiles SET digest_optin = false WHERE id = $1`, [id])
  return NextResponse.json({ ok: true, optin: false })
}
