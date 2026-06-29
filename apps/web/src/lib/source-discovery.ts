import Parser from 'rss-parser'
import { query } from '@/lib/db'
import { channelFeed, resolveChannelId } from '@/lib/youtube'
import { processArticles } from '@/ingest'
import { rssConnector } from '@/ingest/rss'
import type { TopicRow } from '@/ingest/index'

const UA = 'Mozilla/5.0 (compatible; NewsHubBot/0.4; +https://newshub.app)'
const parser = new Parser({ timeout: 15000 })

export type NormalizedSource = { kind: 'rss'; url: string; name: string; via: 'youtube' | 'rss' | 'web' }

function looksYouTube(u: string): boolean {
  return /youtube\.com|youtu\.be/.test(u) || u.startsWith('@')
}

// Convierte cualquier entrada (handle/URL de YouTube, feed RSS, o web) en un feed
// RSS válido, o null si no se puede. Valida que el feed realmente tiene items.
export async function normalizeSourceInput(input: string): Promise<NormalizedSource | null> {
  const raw = input.trim()
  if (!raw) return null

  // YouTube (handle, canal o vídeo) → feed del canal
  if (looksYouTube(raw) || (!raw.includes('.') && !/^https?:/.test(raw))) {
    const ch = await resolveChannelId(raw)
    if (ch) return { kind: 'rss', url: channelFeed(ch), name: 'YouTube', via: 'youtube' }
  }

  let url = raw
  if (!/^https?:\/\//.test(url)) url = `https://${url}`

  // ¿Ya es un feed?
  try {
    const f = await parser.parseURL(url)
    if ((f.items?.length ?? 0) > 0) {
      return { kind: 'rss', url, name: (f.title ?? new URL(url).host).slice(0, 120), via: 'rss' }
    }
  } catch {
    /* no era feed directo */
  }

  // Descubrir <link rel="alternate" type="application/rss+xml"> en la web
  try {
    const res = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(12000) })
    const html = await res.text()
    const links = [...html.matchAll(/<link[^>]+>/gi)].map((m) => m[0])
    for (const tag of links) {
      if (!/application\/(rss|atom)\+xml/i.test(tag)) continue
      const href = tag.match(/href=["']([^"']+)["']/i)?.[1]
      if (!href) continue
      const feedUrl = new URL(href, url).toString()
      try {
        const f = await parser.parseURL(feedUrl)
        if ((f.items?.length ?? 0) > 0) {
          return { kind: 'rss', url: feedUrl, name: (f.title ?? new URL(url).host).slice(0, 120), via: 'web' }
        }
      } catch {
        /* sigue probando */
      }
    }
  } catch {
    /* web no accesible */
  }
  return null
}

function emptyResult() {
  return {
    sources: 0,
    fetched: 0,
    inserted: 0,
    embedded: 0,
    clusters_touched: 0,
    notifications: 0,
    errors: [] as { source: string; error: string }[],
  }
}

// Inserta la fuente ligada al tema y la rastrea una vez para que el tema no salga
// vacío. Devuelve cuántos artículos quedaron etiquetados al tema.
export async function addBoundSource(
  topicId: number,
  lang: string,
  ns: NormalizedSource,
  displayName?: string,
): Promise<{ sourceId: number; tagged: number }> {
  const name = displayName?.trim() || ns.name
  const ins = await query<{ id: number }>(
    `INSERT INTO sources (kind, name, url, lang, active, topic_id)
     VALUES ('rss', $1, $2, $3, true, $4)
     ON CONFLICT (kind, url) DO UPDATE SET active = true, topic_id = EXCLUDED.topic_id, name = EXCLUDED.name
     RETURNING id`,
    [name, ns.url, lang, topicId],
  )
  const sourceId = ins.rows[0].id

  const { rows: tRows } = await query<TopicRow>(
    `SELECT id, slug, label, keywords, kind, owner_profile_id FROM topics WHERE id = $1`,
    [topicId],
  )
  try {
    const articles = await rssConnector({ id: sourceId, kind: 'rss', name, url: ns.url, lang, config: {} })
    await processArticles(sourceId, articles, tRows, emptyResult(), false, topicId)
  } catch {
    /* best-effort: el cron lo reintentará */
  }

  const { rows } = await query<{ n: number }>(
    `SELECT count(*)::int AS n FROM article_topics WHERE topic_id = $1`,
    [topicId],
  )
  return { sourceId, tagged: rows[0]?.n ?? 0 }
}
