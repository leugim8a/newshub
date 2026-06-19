import * as cheerio from 'cheerio'
import { query } from '@/lib/db'

// Extrae la imagen principal (og:image / twitter:image) de la página del artículo.
async function fetchOgImage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; NewsHubBot/0.2; +https://newshub.app)' },
      signal: AbortSignal.timeout(6000),
      redirect: 'follow',
    })
    if (!res.ok) return null
    const ct = res.headers.get('content-type') || ''
    if (!ct.includes('text/html')) return null
    const html = (await res.text()).slice(0, 600_000)
    const $ = cheerio.load(html)
    const img =
      $('meta[property="og:image"]').attr('content') ||
      $('meta[property="og:image:url"]').attr('content') ||
      $('meta[name="twitter:image"]').attr('content') ||
      $('meta[name="twitter:image:src"]').attr('content')
    if (!img) return null
    return img.startsWith('http') ? img : new URL(img, url).toString()
  } catch {
    return null
  }
}

// Enriquece con imagen los artículos recientes que no la tienen (best-effort,
// acotado). Salta enlaces de Google News (redirección sin og:image útil).
export async function enrichRecentImages(limit = 40): Promise<number> {
  const { rows } = await query<{ id: number; url: string }>(
    `SELECT id, url FROM articles
     WHERE image_url IS NULL
       AND ingested_at > now() - interval '2 days'
       AND url NOT LIKE '%news.google.com%'
     ORDER BY ingested_at DESC
     LIMIT $1`,
    [limit],
  )

  let updated = 0
  for (let i = 0; i < rows.length; i += 6) {
    const batch = rows.slice(i, i + 6)
    await Promise.all(
      batch.map(async (a) => {
        const img = await fetchOgImage(a.url)
        if (img) {
          await query(`UPDATE articles SET image_url = $1 WHERE id = $2 AND image_url IS NULL`, [
            img,
            a.id,
          ])
          updated++
        }
      }),
    )
  }
  return updated
}
