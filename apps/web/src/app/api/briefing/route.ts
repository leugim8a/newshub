import { NextResponse } from 'next/server'
import { buildBriefing } from '@/lib/briefing'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// GET /api/briefing — el resumen del día: las historias con más cobertura
// (clusters de varias fuentes) de las últimas ~36h, con resumen IA por historia.
export async function GET(req: Request) {
  const lang = new URL(req.url).searchParams.get('lang') === 'en' ? 'en' : 'es'
  const items = await buildBriefing()
  return NextResponse.json({ items, lang, generated_at: new Date().toISOString() })
}
