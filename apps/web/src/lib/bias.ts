// Objetividad por medio (objetiva / mixta / sesgada). NO hay clasificación impuesta:
// es 100% criterio del usuario, editable en Ajustes. Una fuente sin clasificar no
// cuenta en la barra.
export type Level = 'objective' | 'mixed' | 'biased'

// Resolver: una función nombre→nivel. La UI pasa una que consulta los ratings del
// usuario (lib/bias-context). Por defecto, sin clasificar.
export type LevelResolver = (name: string | null | undefined) => Level | null

export type ObjectivityDist = {
  objective: number
  mixed: number
  biased: number
  unknown: number
  rated: number
  total: number
}

export function computeObjectivity(
  names: (string | null | undefined)[],
  resolve: LevelResolver,
): ObjectivityDist {
  let objective = 0,
    mixed = 0,
    biased = 0,
    unknown = 0
  for (const nm of names) {
    const l = resolve(nm)
    if (l === 'objective') objective++
    else if (l === 'mixed') mixed++
    else if (l === 'biased') biased++
    else unknown++
  }
  return { objective, mixed, biased, unknown, rated: objective + mixed + biased, total: names.length }
}

// Aviso: la historia la cubren ≥2 fuentes clasificadas pero NINGUNA objetiva.
export function noObjectiveSource(
  names: (string | null | undefined)[],
  resolve: LevelResolver,
): boolean {
  const d = computeObjectivity(names, resolve)
  return d.rated >= 2 && d.objective === 0
}
