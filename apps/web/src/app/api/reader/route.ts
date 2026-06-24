import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { extractArticle } from '@/lib/extract'

export const dynamic = 'force-dynamic'
export const maxDuration = 20

// GET /api/reader?id= — extrae el texto principal del artículo (reader view).
// Usa el id (la URL viene de BD) para no aceptar URLs arbitrarias.
export async function GET(req: Request) {
  const id = Number(new URL(req.url).searchParams.get('id'))
  if (!id) return NextResponse.json({ error: 'id' }, { status: 400 })

  const { rows } = await query<{ url: string; title: string; image_url: string | null; source_name: string | null }>(
    `SELECT a.url, a.title, a.image_url, s.name AS source_name
     FROM articles a LEFT JOIN sources s ON s.id = a.source_id WHERE a.id = $1`,
    [id],
  )
  if (rows.length === 0) return NextResponse.json({ error: 'no encontrado' }, { status: 404 })
  const art = rows[0]

  const { blocks, image, byline, extracted } = await extractArticle(art.url)
  return NextResponse.json({
    title: art.title,
    url: art.url,
    source: art.source_name,
    image: image || art.image_url,
    byline,
    blocks,
    extracted,
  })
}
