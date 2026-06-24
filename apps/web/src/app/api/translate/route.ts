import { NextResponse } from 'next/server'
import { llmEnabled, translateSummary } from '@/lib/llm'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// POST { summary, bullets, to } — traduce un resumen al idioma destino (es/en).
export async function POST(req: Request) {
  if (!llmEnabled()) return NextResponse.json({ error: 'llm off' }, { status: 503 })
  const body = (await req.json()) as { summary?: string; bullets?: string[]; to?: string }
  const summary = (body.summary ?? '').slice(0, 4000)
  if (!summary) return NextResponse.json({ error: 'summary requerido' }, { status: 400 })
  const to = body.to === 'en' ? 'en' : 'es'
  const bullets = Array.isArray(body.bullets) ? body.bullets.map(String).slice(0, 8) : []

  const out = await translateSummary(summary, bullets, to)
  if (!out) return NextResponse.json({ error: 'no se pudo traducir' }, { status: 502 })
  return NextResponse.json({ ...out, lang: to })
}
