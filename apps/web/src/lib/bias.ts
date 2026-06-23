// Sesgo aproximado por medio (izquierda / centro / derecha), para la "barra de
// sesgo" por historia (estilo Ground News). Aproximación curada; afinable.
export type Bucket = 'left' | 'center' | 'right'

const RULES: { match: string; bucket: Bucket }[] = [
  // España
  { match: 'el país', bucket: 'left' },
  { match: 'eldiario', bucket: 'left' },
  { match: 'el diario', bucket: 'left' },
  { match: 'público', bucket: 'left' },
  { match: 'infolibre', bucket: 'left' },
  { match: 'el mundo', bucket: 'right' },
  { match: 'abc', bucket: 'right' },
  { match: 'la razón', bucket: 'right' },
  { match: 'libertad digital', bucket: 'right' },
  { match: 'okdiario', bucket: 'right' },
  { match: 'expansión', bucket: 'right' },
  { match: 'la vanguardia', bucket: 'center' },
  { match: 'rtve', bucket: 'center' },
  { match: '20minutos', bucket: 'center' },
  { match: 'europa press', bucket: 'center' },
  // Internacional
  { match: 'guardian', bucket: 'left' },
  { match: 'new york times', bucket: 'left' },
  { match: 'washington post', bucket: 'left' },
  { match: 'cnn', bucket: 'left' },
  { match: 'msnbc', bucket: 'left' },
  { match: 'vox', bucket: 'left' },
  { match: 'fox', bucket: 'right' },
  { match: 'wall street journal', bucket: 'right' },
  { match: 'daily mail', bucket: 'right' },
  { match: 'telegraph', bucket: 'right' },
  { match: 'national review', bucket: 'right' },
  { match: 'bbc', bucket: 'center' },
  { match: 'reuters', bucket: 'center' },
  { match: 'associated press', bucket: 'center' },
  { match: 'al jazeera', bucket: 'center' },
  { match: 'bloomberg', bucket: 'center' },
  { match: 'cnbc', bucket: 'center' },
  { match: 'axios', bucket: 'center' },
  // Tech / finanzas → centro
  { match: 'verge', bucket: 'center' },
  { match: 'techcrunch', bucket: 'center' },
  { match: 'ars technica', bucket: 'center' },
  { match: 'venturebeat', bucket: 'center' },
  { match: 'wired', bucket: 'center' },
  { match: 'technology review', bucket: 'center' },
  { match: 'hacker news', bucket: 'center' },
  { match: 'xataka', bucket: 'center' },
  { match: 'rundown', bucket: 'center' },
  { match: 'investing', bucket: 'center' },
  { match: 'cointelegraph', bucket: 'center' },
]

export function biasBucket(name: string | null | undefined): Bucket | null {
  if (!name) return null
  const n = name.toLowerCase()
  for (const r of RULES) if (n.includes(r.match)) return r.bucket
  return null
}

export type BiasDist = { left: number; center: number; right: number; unknown: number; rated: number; total: number }

export function computeBias(names: (string | null | undefined)[]): BiasDist {
  let left = 0,
    center = 0,
    right = 0,
    unknown = 0
  for (const nm of names) {
    const b = biasBucket(nm)
    if (b === 'left') left++
    else if (b === 'center') center++
    else if (b === 'right') right++
    else unknown++
  }
  return { left, center, right, unknown, rated: left + center + right, total: names.length }
}

// Punto ciego: la historia la cubre casi solo un lado → devuelve el lado QUE FALTA.
export function blindspotSide(names: (string | null | undefined)[]): 'left' | 'right' | null {
  const { left, center, right, rated } = computeBias(names)
  if (rated < 3) return null
  if (left / rated >= 0.7 && right / rated <= 0.1) return 'right'
  if (right / rated >= 0.7 && left / rated <= 0.1) return 'left'
  return null
}
