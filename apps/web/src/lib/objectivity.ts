import { gemini } from '@/lib/llm'
import type { Level } from '@/lib/bias'

export type Coverage = {
  sourceId: number
  source: string
  title: string
  summary: string | null
  body?: string | null // texto completo (reader); si falta, se usa el summary
}
export type ClusterScore = { sourceId: number; score: number; reason: string }

// Umbrales media→nivel y muestra mínima para sugerir (configurable).
export const OBJ_THRESHOLDS = { objective: 72, mixed: 50 }
export const OBJ_MIN_SAMPLE = 3

export function levelFromAvg(avg: number, count: number): Level | null {
  if (count < OBJ_MIN_SAMPLE) return null
  if (avg >= OBJ_THRESHOLDS.objective) return 'objective'
  if (avg >= OBJ_THRESHOLDS.mixed) return 'mixed'
  return 'biased'
}

// Compara las coberturas de la MISMA noticia y puntúa la objetividad de cada fuente
// por señales concretas (no por estar de acuerdo con el contenido).
export async function scoreClusterObjectivity(
  coverages: Coverage[],
  lang: 'es' | 'en' = 'es',
): Promise<ClusterScore[] | null> {
  if (coverages.length < 2) return null
  const langName = lang === 'en' ? 'English' : 'español'
  const list = coverages
    .map((c, i) => {
      const text = (c.body ?? c.summary ?? '').slice(0, 2500)
      return `### Cobertura ${i + 1} — ${c.source}\nTitular: ${c.title}\nTexto: ${text}`
    })
    .join('\n\n')

  const prompt = `Eres un analista de medios neutral. Estas son coberturas de la MISMA noticia por distintos medios. Evalúa la OBJETIVIDAD de cada cobertura por señales CONCRETAS, NO por si estás de acuerdo con el contenido ni por la línea editorial del medio:
- Lenguaje cargado o emocional, adjetivación valorativa.
- Opinión presentada como hecho.
- Atribución de afirmaciones a fuentes verificables.
- Si ofrece una sola versión o varias.
- Titular sensacionalista vs descriptivo.

Puntúa de 0 a 100 (100 = totalmente objetiva, factual; 0 = muy sesgada/opinativa). Sé exigente y usa todo el rango.

Devuelve SOLO JSON válido, un array con un objeto por cobertura en el MISMO orden:
[{"n":1,"score":0-100,"reason":"<motivo breve en ${langName}>"}]

Coberturas:
${list}`

  const out = await gemini(prompt, 800)
  if (!out) return null
  let parsed: { n?: number; score?: number; reason?: string }[]
  try {
    parsed = JSON.parse(out.replace(/```json|```/g, '').trim())
  } catch {
    return null
  }
  if (!Array.isArray(parsed)) return null

  const scores: ClusterScore[] = []
  for (const p of parsed) {
    const idx = (p.n ?? 0) - 1
    const cov = coverages[idx]
    if (!cov || typeof p.score !== 'number') continue
    scores.push({
      sourceId: cov.sourceId,
      score: Math.max(0, Math.min(100, Math.round(p.score))),
      reason: String(p.reason ?? '').slice(0, 300),
    })
  }
  return scores.length > 0 ? scores : null
}
