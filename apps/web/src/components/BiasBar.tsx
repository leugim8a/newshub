'use client'

import { EyeOff } from 'lucide-react'
import { computeBias, blindspotSide } from '@/lib/bias'
import { useI18n } from '@/lib/i18n'

// Barra de sesgo (Izq/Centro/Der) de las fuentes que cubren una historia.
export function BiasBar({
  sources,
  compact = false,
}: {
  sources?: (string | null)[] | null
  compact?: boolean
}) {
  const { t } = useI18n()
  if (!sources || sources.length < 2) return null
  const d = computeBias(sources)
  if (d.rated === 0) return null

  const pct = (n: number) => `${(n / d.rated) * 100}%`
  const blind = blindspotSide(sources)

  return (
    <div className={compact ? 'flex items-center gap-2' : 'flex flex-col gap-1.5'}>
      <div className={compact ? 'h-1.5 w-20 overflow-hidden rounded-full' : 'flex h-2.5 w-full overflow-hidden rounded-full'}>
        <div className="flex h-full w-full">
          <div style={{ width: pct(d.left) }} className="bg-sky-500" title={`${t('bias.left')}: ${d.left}`} />
          <div style={{ width: pct(d.center) }} className="bg-zinc-400" title={`${t('bias.center')}: ${d.center}`} />
          <div style={{ width: pct(d.right) }} className="bg-rose-500" title={`${t('bias.right')}: ${d.right}`} />
        </div>
      </div>
      {!compact && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-sky-500" /> {t('bias.left')} {d.left}
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-zinc-400" /> {t('bias.center')} {d.center}
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-rose-500" /> {t('bias.right')} {d.right}
          </span>
          {blind && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 font-medium text-amber-500">
              <EyeOff className="h-3 w-3" />
              {t('bias.blindspot')}: {blind === 'left' ? t('bias.missingLeft') : t('bias.missingRight')}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
