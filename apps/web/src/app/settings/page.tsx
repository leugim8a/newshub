'use client'

import { Globe, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import ShinyText from '@/components/ShinyText'
import { DigestSubscribe } from '@/components/DigestSubscribe'
import { MuteManager } from '@/components/MuteManager'
import { SourceObjectivity } from '@/components/SourceObjectivity'
import { NotificationBell } from '@/components/NotificationBell'
import { Button } from '@/components/ui/button'
import { pushToast } from '@/components/Toaster'
import { useI18n, type Lang } from '@/lib/i18n'

type Preset = { id: string; name: string; description: string }

export default function SettingsPage() {
  const { t, lang, setLang } = useI18n()
  const [presets, setPresets] = useState<Preset[]>([])
  const [applying, setApplying] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/profile/preset')
      .then((r) => r.json())
      .then((d: { presets: Preset[] }) => setPresets(d.presets))
      .catch(() => {})
  }, [])

  const apply = async (id: string) => {
    setApplying(id)
    try {
      await fetch('/api/profile/preset', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      pushToast({ title: t('settings.applied') })
      // Recargar la portada para reflejar temas/fuentes/ajustes nuevos.
      setTimeout(() => {
        window.location.href = '/'
      }, 600)
    } catch {
      setApplying(null)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="mb-8 text-2xl font-semibold tracking-tight">
        <ShinyText text={t('nav.settings')} />
      </h1>

      <div className="flex flex-col gap-3">
        {/* Perfiles por defecto */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-1 flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-accent" />
            <span className="font-medium">{t('settings.presets')}</span>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">{t('settings.presetsDesc')}</p>
          <div className="flex flex-col gap-3">
            {presets.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background/40 p-4"
              >
                <div className="min-w-0">
                  <p className="font-medium">{p.name}</p>
                  <p className="text-sm text-muted-foreground">{p.description}</p>
                </div>
                <Button
                  size="sm"
                  onClick={() => apply(p.id)}
                  disabled={applying !== null}
                  className="shrink-0"
                >
                  {t('settings.apply')}
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <Globe className="h-5 w-5 text-accent" />
            <span className="font-medium">{t('lang.label')}</span>
          </div>
          <div className="flex gap-2">
            {(['es', 'en'] as Lang[]).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLang(l)}
                className={
                  'rounded-full px-4 py-1.5 text-sm font-medium ' +
                  (lang === l
                    ? 'bg-accent text-accent-foreground'
                    : 'border border-border text-muted-foreground hover:text-foreground')
                }
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-4">
          <span className="font-medium">{t('push.enable')}</span>
          <NotificationBell />
        </div>

        <DigestSubscribe />

        <SourceObjectivity />

        <MuteManager />
      </div>
    </div>
  )
}
