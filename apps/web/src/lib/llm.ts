// Cliente LLM (Gemini AI Studio) para resúmenes. Sin clave → degradación elegante.
const KEY = process.env.GEMINI_API_KEY
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash'

export function llmEnabled(): boolean {
  return Boolean(KEY)
}

export async function gemini(prompt: string, maxTokens = 600): Promise<string | null> {
  if (!KEY) return null
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: maxTokens,
            // gemini-2.5-flash es "thinking": sin esto el razonamiento agota los
            // tokens y devuelve texto vacío/truncado.
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
        signal: AbortSignal.timeout(30000),
      },
    )
    if (!res.ok) return null
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[]
    }
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? null
  } catch {
    return null
  }
}

function parseJson<T>(raw: string): T | null {
  try {
    return JSON.parse(raw.replace(/```json|```/g, '').trim()) as T
  } catch {
    return null
  }
}

// Traduce un resumen (texto + bullets) al idioma destino, conservando la estructura.
export async function translateSummary(
  summary: string,
  bullets: string[],
  to: 'es' | 'en',
): Promise<{ summary: string; bullets: string[] } | null> {
  const langName = to === 'en' ? 'English' : 'español'
  const prompt = `Traduce los valores de este JSON al ${langName}. NO traduzcas las claves. Devuelve SOLO el JSON traducido, misma estructura:
${JSON.stringify({ summary, bullets })}`
  const out = await gemini(prompt, 800)
  if (!out) return null
  const json = parseJson<{ summary?: string; bullets?: string[] }>(out)
  if (!json) return null
  return {
    summary: String(json.summary ?? ''),
    bullets: Array.isArray(json.bullets) ? json.bullets.map(String) : [],
  }
}

// Resume un artículo individual (botón "Resumir" bajo demanda).
export async function summarizeArticle(
  title: string,
  body: string | null,
  lang: 'es' | 'en' = 'es',
): Promise<{ summary: string; bullets: string[] } | null> {
  const langName = lang === 'en' ? 'English' : 'español'
  const prompt = `Eres un editor de noticias. Resume esta noticia en ${langName}:
1) Un resumen claro de 2 frases.
2) 3 puntos clave concisos.
Devuelve SOLO JSON válido: {"summary":"...","bullets":["...","...","..."]}

Titular: ${title}
${body ? `Texto: ${body.slice(0, 1200)}` : ''}`
  const out = await gemini(prompt)
  if (!out) return null
  const json = parseJson<{ summary?: string; bullets?: string[] }>(out)
  if (!json) return null
  return {
    summary: String(json.summary ?? ''),
    bullets: Array.isArray(json.bullets) ? json.bullets.map(String).slice(0, 4) : [],
  }
}

// Resume una historia (cluster) a partir de las coberturas de varios medios.
export async function summarizeCluster(
  headline: string,
  articles: { title: string; summary: string | null; source: string | null }[],
  lang: 'es' | 'en' = 'es',
): Promise<{ summary: string; bullets: string[] } | null> {
  const ctx = articles
    .slice(0, 8)
    .map((a) => `- [${a.source ?? ''}] ${a.title}. ${(a.summary ?? '').slice(0, 240)}`)
    .join('\n')
  const langName = lang === 'en' ? 'English' : 'español'
  const prompt = `Eres un editor de noticias. Estas son coberturas de la MISMA historia por varios medios. En ${langName}, escribe:
1) Un resumen NEUTRAL de 2 frases.
2) 3 puntos clave concisos.
Devuelve SOLO JSON válido: {"summary":"...","bullets":["...","...","..."]}

Titular: ${headline}
Coberturas:
${ctx}`
  const out = await gemini(prompt)
  if (!out) return null
  const json = parseJson<{ summary?: string; bullets?: string[] }>(out)
  if (!json) return null
  return {
    summary: String(json.summary ?? ''),
    bullets: Array.isArray(json.bullets) ? json.bullets.map(String).slice(0, 4) : [],
  }
}
