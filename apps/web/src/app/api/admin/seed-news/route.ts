import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Fuentes de ACTUALIDAD generalistas (RSS validados). NO se ligan a un tema: la
// ingesta las casa por keyword/semántica a politica/internacional/economia, dándole
// cuerpo a la sección Actualidad.
const NEWS: { name: string; url: string; lang: string }[] = [
  { name: '20minutos', url: 'https://www.20minutos.es/rss/', lang: 'es' },
  { name: 'eldiario.es', url: 'https://www.eldiario.es/rss/', lang: 'es' },
  { name: 'La Vanguardia', url: 'https://www.lavanguardia.com/rss/home.xml', lang: 'es' },
  { name: 'ABC — Portada', url: 'https://www.abc.es/rss/2.0/portada/', lang: 'es' },
  { name: 'ABC — España', url: 'https://www.abc.es/rss/2.0/espana/', lang: 'es' },
  { name: 'El Confidencial', url: 'https://rss.elconfidencial.com/espana/', lang: 'es' },
  { name: 'Europa Press', url: 'https://www.europapress.es/rss/rss.aspx', lang: 'es' },
  { name: 'BBC Mundo', url: 'https://feeds.bbci.co.uk/mundo/rss.xml', lang: 'es' },
  { name: 'Expansión', url: 'https://e00-expansion.uecdn.es/rss/portada.xml', lang: 'es' },
]

export async function POST(req: Request) {
  const token = process.env.INGEST_TOKEN
  const auth = req.headers.get('authorization')
  if (token && auth !== `Bearer ${token}`)
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let list = NEWS
  try {
    const body = (await req.json()) as { sources?: typeof NEWS }
    if (Array.isArray(body.sources) && body.sources.length > 0) list = body.sources
  } catch {
    /* lista por defecto */
  }

  const added: string[] = []
  for (const s of list) {
    await query(
      `INSERT INTO sources (kind, name, url, lang, active)
       VALUES ('rss', $1, $2, $3, true)
       ON CONFLICT (kind, url) DO UPDATE SET active = true, name = EXCLUDED.name`,
      [s.name, s.url, s.lang],
    )
    added.push(s.name)
  }
  return NextResponse.json({ added })
}
