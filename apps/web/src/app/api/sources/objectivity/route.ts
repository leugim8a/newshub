import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { levelFromAvg } from '@/lib/objectivity'

export const dynamic = 'force-dynamic'

// GET — mapa { nombre de fuente → objetividad efectiva } para pintar las barras.
// Efectiva = rating manual del usuario si existe; si no, la sugerencia de la IA
// (media de objectivity_scores) cuando hay muestra suficiente.
export async function GET() {
  const { rows } = await query<{
    name: string
    objectivity: string | null
    ai_avg: number | null
    ai_count: number
  }>(
    `SELECT s.name, s.objectivity,
            round(avg(os.score))::int AS ai_avg,
            count(os.score)::int      AS ai_count
       FROM sources s
       LEFT JOIN objectivity_scores os ON os.source_id = s.id
      GROUP BY s.id`,
  )
  const overrides: Record<string, string> = {}
  for (const r of rows) {
    let level: string | null = r.objectivity
    if (!level && r.ai_avg != null) level = levelFromAvg(r.ai_avg, r.ai_count)
    if (level) overrides[r.name] = level
  }
  return NextResponse.json({ overrides })
}
