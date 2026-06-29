import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET — mapa { nombre de fuente → objetividad } según la clasificación MANUAL del
// usuario. Lo consume el BiasProvider para pintar las barras de las historias.
export async function GET() {
  const { rows } = await query<{ name: string; objectivity: string }>(
    `SELECT name, objectivity FROM sources WHERE objectivity IS NOT NULL`,
  )
  const overrides: Record<string, string> = {}
  for (const r of rows) overrides[r.name] = r.objectivity
  return NextResponse.json({ overrides })
}
