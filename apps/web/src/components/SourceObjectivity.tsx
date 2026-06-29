'use client'

import { Scale } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useBias } from '@/lib/bias-context'
import type { Level } from '@/lib/bias'
import { useI18n } from '@/lib/i18n'

type Source = {
  id: number
  name: string
  objectivity: Level | null
  article_count: string
}

const LEVELS: { value: Level; key: string; cls: string }[] = [
  { value: 'objective', key: 'obj.objective', cls: 'bg-emerald-500 text-white border-emerald-500' },
  { value: 'mixed', key: 'obj.mixed', cls: 'bg-amber-400 text-black border-amber-400' },
  { value: 'biased', key: 'obj.biased', cls: 'bg-rose-500 text-white border-rose-500' },
]

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
    setOverride(s.name, next) // refleja al instante en las barras
    await fetch('/api/sources', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: s.id, objectivity: next }),
    }).catch(() => {})
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-1 flex items-center gap-3">
        <Scale className="h-5 w-5 text-accent" />
        <span className="font-medium">{t('obj.editorTitle')}</span>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">{t('obj.editorDesc')}</p>

      <div className="flex flex-col divide-y divide-border">
        {sources.map((s) => (
          <div key={s.id} className="flex items-center justify-between gap-3 py-2.5">
            <span className="min-w-0 flex-1 truncate text-sm" title={s.name}>
              {s.name}
            </span>
            <div className="flex shrink-0 items-center gap-1">
              {LEVELS.map((lv) => {
                const on = s.objectivity === lv.value
                return (
                  <button
                    key={lv.value}
                    type="button"
                    onClick={() => rate(s, lv.value)}
                    className={
                      'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ' +
                      (on ? lv.cls : 'border-border text-muted-foreground hover:text-foreground')
                    }
                  >
                    {t(lv.key as Parameters<typeof t>[0])}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
        {sources.length === 0 && <p className="py-3 text-sm text-muted-foreground">…</p>}
      </div>
    </div>
  )
}
