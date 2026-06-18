'use client'

import { Globe } from 'lucide-react'
import ShinyText from '@/components/ShinyText'
import { NotificationBell } from '@/components/NotificationBell'
import { useI18n, type Lang } from '@/lib/i18n'

export default function SettingsPage() {
  const { t, lang, setLang } = useI18n()

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
      </div>
    </div>
  )
}
