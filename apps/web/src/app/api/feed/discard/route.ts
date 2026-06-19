import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
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

// POST { articleId } — descarta una noticia (se oculta del feed del perfil).
export async function POST(req: Request) {
  const { id, isNew } = await resolve()
  const body = (await req.json()) as { articleId?: number }
  if (!body.articleId) return NextResponse.json({ error: 'articleId requerido' }, { status: 400 })
  await query(
    `INSERT INTO discarded_articles (profile_id, article_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
    [id, body.articleId],
  )
  return withCookie(NextResponse.json({ ok: true }), id, isNew)
}

// DELETE { articleId } — deshace el descarte.
export async function DELETE(req: Request) {
  const { id, isNew } = await resolve()
  const body = (await req.json()) as { articleId?: number }
  if (!body.articleId) return NextResponse.json({ error: 'articleId requerido' }, { status: 400 })
  await query(`DELETE FROM discarded_articles WHERE profile_id = $1 AND article_id = $2`, [
    id,
    body.articleId,
  ])
  return withCookie(NextResponse.json({ ok: true }), id, isNew)
}
