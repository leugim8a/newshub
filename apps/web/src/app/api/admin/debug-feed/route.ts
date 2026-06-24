import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET ?url= — diagnóstico: qué ve el SERVIDOR al pedir un feed (status, bytes, nº de
// <entry>, primeros caracteres). Protegido por token.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  if (searchParams.get('token') !== process.env.INGEST_TOKEN)
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const url = searchParams.get('url')
  if (!url) return NextResponse.json({ error: 'url' }, { status: 400 })

  const variants = [
    { name: 'plain', headers: {} as Record<string, string> },
    {
      name: 'browser',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        Cookie: 'CONSENT=YES+cb',
      },
    },
  ]
  const out: Record<string, unknown>[] = []
  for (const v of variants) {
    try {
      const r = await fetch(url, { headers: v.headers, signal: AbortSignal.timeout(12000) })
      const body = await r.text()
      out.push({
        variant: v.name,
        status: r.status,
        bytes: body.length,
        entries: (body.match(/<entry>/g) || []).length,
        head: body.slice(0, 160).replace(/\s+/g, ' '),
      })
    } catch (e) {
      out.push({ variant: v.name, error: (e as Error).message })
    }
  }
  return NextResponse.json({ url, results: out })
}
