'use client'

import { Scale, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useBias } from '@/lib/bias-context'
import type { Level } from '@/lib/bias'
import { useI18n } from '@/lib/i18n'

type Source = {
  id: number
  name: string
  objectivity: Level | null
  article_count: string
  ai_avg: number | null
  ai_count: number
}

const LEVELS: { value: Level; key: string; cls: string }[] = [
  { value: 'objective', key: 'obj.objective', cls: 'bg-emerald-500 text-white border-emerald-500' },
  { value: 'mixed', key: 'obj.mixed', cls: 'bg-amber-400 text-black border-amber-400' },
  { value: 'biased', key: 'obj.biased', cls: 'bg-rose-500 text-white border-rose-500' },
]

// Mismos umbrales que lib/objectivity (servidor): media→nivel, muestra mínima 3.
function suggest(avg: number | null, count: number): Level | null {
  if (avg == null || count < 3) return null
  if (avg >= 72) return 'objective'
  if (avg >= 50) return 'mixed'
  return 'biased'
}

export function SourceObjectivity() {
  const { t } = useI18n()
  const { setOverride } = useBias()
  const [sources, setSources] = useState<Source[]>([])

  useEffect(() => {
    fetch('/api/sources')
      .then((r) => r.json())
      .then((d: { sources: Source[] }) => setSources(d.sources))
      .catch(() => {})
  }, [])

  const rate = async (s: Source, level: Level | null) => {
    const next = s.objectivity === level ? null : level // re-pulsar = quitar
    setSources((prev) => prev.map((x) => (x.id === s.id ? { ...x, objectivity: next } : x)))
    setOverride(s.name, next ?? suggest(s.ai_avg, s.ai_count)) // refleja al instante
    await fetch('/api/sources', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: s.id, objectivity: next }),
    }).catch(() => {})
  }

  const labelOf = (lv: Level) => t(LEVELS.find((x) => x.value === lv)!.key as Parameters<typeof t>[0])

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-1 flex items-center gap-3">
        <Scale className="h-5 w-5 text-accent" />
        <span className="font-medium">{t('obj.editorTitle')}</span>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">{t('obj.editorDesc')}</p>

      <div className="flex flex-col divide-y divide-border">
        {sources.map((s) => {
          const ai = suggest(s.ai_avg, s.ai_count)
          return (
            <div key={s.id} className="flex flex-col gap-1.5 py-2.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <span className="block truncate text-sm" title={s.name}>
                  {s.name}
                </span>
                {s.ai_count > 0 && (
                  <span className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Sparkles className="h-3 w-3 text-accent" />
                    {t('obj.aiSuggest')}: {ai ? labelOf(ai) : '—'} · {s.ai_avg}/100 ·{' '}
                    {s.ai_count} {t('obj.aiSamples')}
                  </span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {LEVELS.map((lv) => {
                  const on = s.objectivity === lv.value
                  const isAi = !s.objectivity && ai === lv.value
                  return (
                    <button
                      key={lv.value}
                      type="button"
                      onClick={() => rate(s, lv.value)}
                      title={isAi ? t('obj.aiSuggest') : undefined}
                      className={
                        'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ' +
                        (on
                          ? lv.cls
                          : isAi
                            ? 'border-dashed border-accent/60 text-accent'
                            : 'border-border text-muted-foreground hover:text-foreground')
                      }
                    >
                      {t(lv.key as Parameters<typeof t>[0])}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
        {sources.length === 0 && <p className="py-3 text-sm text-muted-foreground">…</p>}
      </div>
    </div>
  )
}
