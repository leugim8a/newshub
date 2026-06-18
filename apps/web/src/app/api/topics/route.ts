import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { rows } = await query(
    `SELECT t.slug, t.label, t.lang, t.followed,
            count(at.article_id) AS article_count
     FROM topics t
     LEFT JOIN article_topics at ON at.topic_id = t.id
     GROUP BY t.id
     ORDER BY t.label`,
  )
  return NextResponse.json({ topics: rows })
}

// PATCH /api/topics  { slug, followed }  — seguir / dejar de seguir
export async function PATCH(req: Request) {
  const body = (await req.json()) as { slug?: string; followed?: boolean }
  if (!body.slug || typeof body.followed !== 'boolean') {
    return NextResponse.json({ error: 'slug y followed requeridos' }, { status: 400 })
  }
  await query(`UPDATE topics SET followed = $2 WHERE slug = $1`, [body.slug, body.followed])
  return NextResponse.json({ ok: true })
}
