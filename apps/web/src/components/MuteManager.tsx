'use client'

import { BellOff, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n'

type Mute = { id: number; kind: 'keyword' | 'source'; value: string }

export function MuteManager() {
  const { t } = useI18n()
  const [mutes, setMutes] = useState<Mute[]>([])
  const [kind, setKind] = useState<'keyword' | 'source'>('keyword')
  const [value, setValue] = useState('')

  const load = () =>
    fetch('/api/mute')
      .then((r) => r.json())
      .then((d: { mutes: Mute[] }) => setMutes(d.mutes))
      .catch(() => {})

  useEffect(() => {
    load()
  }, [])

  const add = async () => {
    const v = value.trim()
    if (!v) return
    await fetch('/api/mute', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind, value: v }),
    })
    setValue('')
    load()
  }

  const remove = async (id: number) => {
    await fetch('/api/mute', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    load()
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-1 flex items-center gap-3">
        <BellOff className="h-5 w-5 text-accent" />
        <span className="font-medium">{t('mute.title')}</span>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">{t('mute.desc')}</p>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-full border border-border p-0.5">
          {(['keyword', 'source'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={
                'rounded-full px-3 py-1 text-xs font-medium transition-colors ' +
                (kind === k
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:text-foreground')
              }
            >
              {t(`mute.${k}`)}
            </button>
          ))}
        </div>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder={t('mute.placeholder')}
          className="min-w-0 flex-1 rounded-full border border-border bg-background/40 px-4 py-1.5 text-sm outline-none focus:border-accent"
        />
        <Button size="sm" onClick={add} disabled={!value.trim()}>
          {t('mute.add')}
        </Button>
      </div>

      {mutes.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('mute.empty')}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {mutes.map((m) => (
            <span
              key={m.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/40 py-1 pl-3 pr-1.5 text-sm"
            >
              <span className="text-xs text-muted-foreground">
                {m.kind === 'source' ? '📰' : '#'}
              </span>
              {m.value}
              <button
                type="button"
                aria-label="Quitar"
                onClick={() => remove(m.id)}
                className="flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
