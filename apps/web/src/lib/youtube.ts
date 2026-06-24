// Resuelve el channel_id (UC…) de un canal de YouTube a partir de un handle (@x),
// nombre o URL, y construye su feed RSS (Atom). El feed da los ~15 vídeos recientes.
const UA = 'Mozilla/5.0 (compatible; NewsHubBot/0.4; +https://newshub.app)'

export function channelFeed(channelId: string): string {
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
}

export async function resolveChannelId(input: string): Promise<string | null> {
  const raw = input.trim()

  // Ya es un id o una URL /channel/UC…
  const direct = raw.match(/(UC[\w-]{20,})/)
  if (direct && (raw.startsWith('UC') || raw.includes('/channel/'))) return direct[1]

  let url = raw
  if (!/^https?:\/\//.test(url)) {
    url = `https://www.youtube.com/@${raw.replace(/^@/, '')}`
  }

  try {
    const res = await fetch(url, {
      headers: { 'user-agent': UA, 'accept-language': 'es-ES,es;q=0.9,en;q=0.8' },
      signal: AbortSignal.timeout(12000),
      redirect: 'follow',
    })
    if (!res.ok) return null
    const html = await res.text()
    // Prioriza el id CANÓNICO del canal (evita coger un canal recomendado/clips):
    // <link rel="canonical"> → "externalId" → og:url → fallback.
    const m =
      html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{20,})">/) ||
      html.match(/"externalId":"(UC[\w-]{20,})"/) ||
      html.match(/<meta property="og:url" content="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{20,})">/) ||
      html.match(/\/channel\/(UC[\w-]{20,})/) ||
      html.match(/(UC[\w-]{22})/)
    return m ? m[1] : null
  } catch {
    return null
  }
}
