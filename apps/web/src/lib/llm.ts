// Cliente LLM (Gemini AI Studio). Sin clave → degradación elegante.
// Único uso restante: descubrimiento de fuentes con IA ("Sugerir con IA"), bajo demanda.
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
