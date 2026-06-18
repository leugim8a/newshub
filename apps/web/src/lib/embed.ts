// Cliente del microservicio de embeddings self-hosted (newshub-embed).
// EMBED_URL p.ej. http://localhost:8089 (dev) o http://newshub-embed:8089 (Coolify).

const EMBED_URL = process.env.EMBED_URL

export function embedEnabled(): boolean {
  return Boolean(EMBED_URL)
}

// Devuelve un vector por texto, o null si el servicio no está disponible
// (degradación elegante: la ingesta sigue, sin clustering).
export async function embedTexts(
  texts: string[],
  type: 'passage' | 'query' = 'passage',
): Promise<number[][] | null> {
  if (!EMBED_URL || texts.length === 0) return null
  try {
    const headers: Record<string, string> = { 'content-type': 'application/json' }
    if (process.env.EMBED_TOKEN) headers.authorization = `Bearer ${process.env.EMBED_TOKEN}`
    const res = await fetch(`${EMBED_URL}/embed`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ texts, type }),
      signal: AbortSignal.timeout(30000),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { embeddings?: number[][] }
    return data.embeddings ?? null
  } catch {
    return null
  }
}

// Formato literal de pgvector: '[0.1,0.2,...]'
export function toVector(arr: number[]): string {
  return `[${arr.join(',')}]`
}
