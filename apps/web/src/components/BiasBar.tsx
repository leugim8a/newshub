'use client'

import { AlertTriangle } from 'lucide-react'
import { computeObjectivity, noObjectiveSource } from '@/lib/bias'
import { useBias } from '@/lib/bias-context'
import { useI18n } from '@/lib/i18n'

// Barra de OBJETIVIDAD (Objetiva/Mixta/Sesgada) de las fuentes que cubren una
// historia, según el criterio del usuario (editable en Ajustes).
export function BiasBar({
  sources,
  compact = false,
}: {
  sources?: (string | null)[] | null
  compact?: boolean
}) {
  const { t } = useI18n()
  const { levelOf } = useBias()
  if (!sources || sources.length < 2) return null
  const d = computeObjectivity(sources, levelOf)
  if (d.rated === 0) return null

  const pct = (n: number) => `${(n / d.rated) * 100}%`
  const warn = noObjectiveSource(sources, levelOf)

  return (
    <div className={compact ? 'flex items-center gap-2' : 'flex flex-col gap-1.5'}>
      <div
        className={
          compact
            ? 'h-1.5 w-20 overflow-hidden rounded-full'
            : 'flex h-2.5 w-full overflow-hidden rounded-full'
        }
      >
        <div className="flex h-full w-full">
          <div
            style={{ width: pct(d.objective) }}
            className="bg-emerald-500"
            title={`${t('obj.objective')}: ${d.objective}`}
          />
          <div
            style={{ width: pct(d.mixed) }}
            className="bg-amber-400"
            title={`${t('obj.mixed')}: ${d.mixed}`}
          />
          <div
            style={{ width: pct(d.biased) }}
            className="bg-rose-500"
            title={`${t('obj.biased')}: ${d.biased}`}
          />
        </div>
      </div>
      {!compact && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> {t('obj.objective')} {d.objective}
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-amber-400" /> {t('obj.mixed')} {d.mixed}
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-rose-500" /> {t('obj.biased')} {d.biased}
          </span>
          {warn && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 font-medium text-amber-500">
              <AlertTriangle className="h-3 w-3" />
              {t('obj.noObjective')}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
