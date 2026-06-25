// Eje de "dependencia institucional": cuánta PUBLICIDAD INSTITUCIONAL del Estado
// recibió el grupo de comunicación al que pertenece cada medio. Es un eje DISTINTO
// del de objetividad por estilo (un medio puede escribir factual y a la vez depender
// del dinero público). Fuente: Informe de Publicidad y Comunicación Institucional 2025
// (CPCI / Moncloa), Anexo IV "Inversión por grupos".
export const AD_SPEND_YEAR = 2025
export const AD_SPEND_URL =
  'https://www.lamoncloa.gob.es/serviciosdeprensa/cpci/Documents/Informe%202025.pdf'
// % máximo (Grupo Prisa) para escalar la barra.
export const AD_SPEND_MAX_PCT = 16.63

export type Group = { key: string; label: string; amount: number; pct: number }

// Importes ejecutados 2025 (€) por grupo. Tabla del Informe (top + algunos pequeños
// para contraste).
export const GROUPS: Record<string, Group> = {
  prisa: { key: 'prisa', label: 'Grupo Prisa', amount: 12_178_931, pct: 16.63 },
  atresmedia: { key: 'atresmedia', label: 'Atresmedia-Planeta', amount: 8_929_631, pct: 12.19 },
  mediaset: { key: 'mediaset', label: 'Mediaset España', amount: 5_756_090, pct: 7.86 },
  vocento: { key: 'vocento', label: 'Grupo Vocento', amount: 3_655_417, pct: 4.99 },
  google: { key: 'google', label: 'Google', amount: 2_997_779, pct: 4.09 },
  'unidad-editorial': { key: 'unidad-editorial', label: 'Unidad Editorial', amount: 2_726_349, pct: 3.72 },
  'prensa-iberica': { key: 'prensa-iberica', label: 'Prensa Ibérica', amount: 2_601_099, pct: 3.55 },
  cope: { key: 'cope', label: 'COPE-Ábside Media', amount: 2_491_768, pct: 3.4 },
  godo: { key: 'godo', label: 'Grupo Godó', amount: 1_863_103, pct: 2.54 },
  meta: { key: 'meta', label: 'Meta Platforms', amount: 1_462_281, pct: 2.0 },
  rtve: { key: 'rtve', label: 'RTVE', amount: 1_377_055, pct: 1.88 },
  henneo: { key: 'henneo', label: 'Grupo Henneo', amount: 1_323_148, pct: 1.81 },
  spotify: { key: 'spotify', label: 'Spotify', amount: 1_298_664, pct: 1.77 },
  'el-espanol': { key: 'el-espanol', label: 'El Español', amount: 340_661, pct: 0.47 },
  'libertad-digital': { key: 'libertad-digital', label: 'Libertad Digital', amount: 2_118, pct: 0.003 },
}

// Reglas medio→grupo por subcadena del nombre de la fuente (curado). Solo medios
// españoles; los internacionales (BBC, Reuters…) no reciben publicidad del Estado
// español → sin dato.
const RULES: { match: string; key: string }[] = [
  { match: 'el país', key: 'prisa' },
  { match: 'cadena ser', key: 'prisa' },
  { match: 'los 40', key: 'prisa' },
  { match: 'cinco días', key: 'prisa' },
  { match: 'as.com', key: 'prisa' },
  { match: 'el mundo', key: 'unidad-editorial' },
  { match: 'marca', key: 'unidad-editorial' },
  { match: 'expansión', key: 'unidad-editorial' },
  { match: 'telva', key: 'unidad-editorial' },
  { match: 'la vanguardia', key: 'godo' },
  { match: 'mundo deportivo', key: 'godo' },
  { match: 'rac1', key: 'godo' },
  { match: 'abc', key: 'vocento' },
  { match: 'el correo', key: 'vocento' },
  { match: 'diario vasco', key: 'vocento' },
  { match: 'las provincias', key: 'vocento' },
  { match: 'el periódico', key: 'prensa-iberica' },
  { match: 'la nueva españa', key: 'prensa-iberica' },
  { match: 'levante', key: 'prensa-iberica' },
  { match: 'información', key: 'prensa-iberica' },
  { match: 'cope', key: 'cope' },
  { match: '20minutos', key: 'henneo' },
  { match: '20 minutos', key: 'henneo' },
  { match: 'heraldo', key: 'henneo' },
  { match: 'huffington', key: 'henneo' },
  { match: 'rtve', key: 'rtve' },
  { match: 'antena 3', key: 'atresmedia' },
  { match: 'lasexta', key: 'atresmedia' },
  { match: 'la sexta', key: 'atresmedia' },
  { match: 'onda cero', key: 'atresmedia' },
  { match: 'atresmedia', key: 'atresmedia' },
  { match: 'telecinco', key: 'mediaset' },
  { match: 'mediaset', key: 'mediaset' },
  { match: 'el español', key: 'el-espanol' },
  { match: 'libertad digital', key: 'libertad-digital' },
]

export type Dependence = Group & { year: number; url: string }

export function dependenceForSource(name: string | null | undefined): Dependence | null {
  if (!name) return null
  const n = name.toLowerCase()
  for (const r of RULES) {
    if (n.includes(r.match)) {
      const g = GROUPS[r.key]
      if (g) return { ...g, year: AD_SPEND_YEAR, url: AD_SPEND_URL }
    }
  }
  return null
}

export function formatEuro(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1).replace('.', ',')} M€`
  if (amount >= 1_000) return `${Math.round(amount / 1_000)} k€`
  return `${amount} €`
}
