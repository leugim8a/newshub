'use client'

import { Globe, KeyRound, Check } from 'lucide-react'
import { useEffect, useState } from 'react'
import ShinyText from '@/components/ShinyText'
import { NotificationBell } from '@/components/NotificationBell'
import { Button } from '@/components/ui/button'
import { useI18n, type Lang } from '@/lib/i18n'

export default function SettingsPage() {
  const { t, lang, setLang } = useI18n()
  const [hasKey, setHasKey] = useState(false)
  const [keyInput, setKeyInput] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetch('/api/profile')
      .then((r) => r.json())
      .then((d: { hasGnewsKey?: boolean }) => setHasKey(Boolean(d.hasGnewsKey)))
  }, [])

  const saveKey = async () => {
    if (!keyInput.trim()) return
    setBusy(true)
    await fetch('/api/settings/gnews-key', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key: keyInput.trim() }),
    })
    setKeyInput('')
    setHasKey(true)
    setBusy(false)
  }

  const clearKey = async () => {
    setBusy(true)
    await fetch('/api/settings/gnews-key', { method: 'DELETE' })
    setHasKey(false)
    setBusy(false)
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="mb-8 text-2xl font-semibold tracking-tight">
        <ShinyText text={t('nav.settings')} />
      </h1>

      <div className="flex flex-col gap-3">
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

        {/* BYOK: clave GNews propia */}
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-1 flex items-center gap-3">
            <KeyRound className="h-5 w-5 text-accent" />
            <span className="font-medium">{t('settings.gnews')}</span>
            {hasKey && (
              <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-accent">
                <Check className="h-4 w-4" />
                {t('settings.gnewsActive')}
              </span>
            )}
          </div>
          <p className="mb-3 text-sm text-muted-foreground">{t('settings.gnewsDesc')}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder={t('settings.gnewsPlaceholder')}
              className="h-10 flex-1 rounded-full border border-input bg-background px-4 text-sm outline-none focus:border-accent"
            />
            <Button onClick={saveKey} disabled={busy || !keyInput.trim()}>
              {t('settings.save')}
            </Button>
            {hasKey && (
              <Button variant="ghost" onClick={clearKey} disabled={busy}>
                {t('settings.clear')}
              </Button>
            )}
          </div>
          <a
            href="https://gnews.io"
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block text-xs text-muted-foreground underline hover:text-foreground"
          >
            {t('settings.getKey')}
          </a>
        </div>
      </div>
    </div>
  )
}
