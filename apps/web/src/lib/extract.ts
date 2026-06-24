import * as cheerio from 'cheerio'

export type Block = { tag: 'p' | 'h'; text: string }
export type Extracted = { blocks: Block[]; image: string | null; byline?: string; extracted: boolean }

// Descarga una URL de artículo y extrae el texto principal (heurística readability).
// Compartido por el reader view (/api/reader) y el scorer de objetividad.
export async function extractArticle(url: string): Promise<Extracted> {
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; NewsHubBot/0.3; +https://newshub.app)' },
      signal: AbortSignal.timeout(12000),
      redirect: 'follow',
    })
    if (!res.ok) throw new Error('http ' + res.status)
    const html = (await res.text()).slice(0, 2_000_000)
    const $ = cheerio.load(html)

    $(
      'script, style, nav, header, footer, aside, form, figure, iframe, .ad, .ads, .newsletter, .related, [aria-hidden=true]',
    ).remove()

    let best: cheerio.Cheerio<never> | null = null
    let bestLen = 0
    const candidates = $(
      'article, main, [role=main], .article-body, .post-content, .entry-content, .content, body',
    )
    candidates.each((_, el) => {
      const $el = $(el)
      const len = $el.find('p').text().length
      if (len > bestLen) {
        bestLen = len
        best = $el as never
      }
    })
    const root = best ?? $('body')

    const image = $('meta[property="og:image"]').attr('content') || null
    const byline =
      $('meta[name="author"]').attr('content') ||
      $('[rel=author]').first().text().trim() ||
      undefined

    const blocks: Block[] = []
    root.find('p, h2, h3').each((_, el) => {
      const tag = el.tagName?.toLowerCase()
      const text = $(el).text().replace(/\s+/g, ' ').trim()
      if (!text || text.length < 30) return
      blocks.push({ tag: tag === 'p' ? 'p' : 'h', text })
    })

    return { blocks: blocks.slice(0, 120), image, byline, extracted: blocks.length > 0 }
  } catch {
    return { blocks: [], image: null, extracted: false }
  }
}

// Texto plano del cuerpo (para pasarlo al LLM), recortado a maxChars.
export async function extractText(url: string, maxChars = 3500): Promise<string | null> {
  const { blocks, extracted } = await extractArticle(url)
  if (!extracted) return null
  const text = blocks
    .filter((b) => b.tag === 'p')
    .map((b) => b.text)
    .join(' ')
  return text ? text.slice(0, maxChars) : null
}
