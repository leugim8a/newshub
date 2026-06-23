import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { llmEnabled, summarizeArticle } from '@/lib/llm'

export const dynamic = 'force-dynamic'
export const maxDuration = 40

// GET /api/article/summary?id= — resumen IA bajo demanda de un artículo.
// Devuelve el cacheado si existe; si no, lo genera y lo guarda en articles.ai_summary.
export async function GET(req: Request) {
  const id = Number(new URL(req.url).searchParams.get('id'))
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const { rows } = await query<{
    title: string
    summary: string | null
    lang: string
    ai_summary: string | null
    ai_bullets: string[] | null
  }>(
    `SELECT title, summary, lang, ai_summary, ai_bullets FROM articles WHERE id = $1`,
    [id],
  )
  if (rows.length === 0) return NextResponse.json({ error: 'no encontrado' }, { status: 404 })
  const a = rows[0]

  const lang = a.lang === 'en' ? 'en' : 'es'

  if (a.ai_summary) {
    return NextResponse.json({ summary: a.ai_summary, bullets: a.ai_bullets ?? [], lang, cached: true })
  }
  if (!llmEnabled()) {
    return NextResponse.json({ summary: null, bullets: [], lang, cached: false })
  }

  const gen = await summarizeArticle(a.title, a.summary, lang)
  if (!gen) return NextResponse.json({ summary: null, bullets: [], lang, cached: false })

  await query(
    `UPDATE articles SET ai_summary = $2, ai_bullets = $3, ai_summarized_at = now() WHERE id = $1`,
    [id, gen.summary, JSON.stringify(gen.bullets)],
  )
  return NextResponse.json({ summary: gen.summary, bullets: gen.bullets, lang, cached: false })
}
