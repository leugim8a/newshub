'use client'

import { Mail } from 'lucide-react'
import { useEffect, useState } from 'react'
import { pushToast } from '@/components/Toaster'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n'

export function DigestSubscribe() {
  const { t, lang } = useI18n()
  const [email, setEmail] = useState('')
  const [optin, setOptin] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetch('/api/digest/subscribe')
      .then((r) => r.json())
      .then((d: { email: string | null; optin: boolean }) => {
        if (d.email) setEmail(d.email)
        setOptin(d.optin)
      })
      .catch(() => {})
  }, [])

  const subscribe = async () => {
    setBusy(true)
    try {
      const r = await fetch('/api/digest/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), lang }),
      })
      if (r.ok) {
        setOptin(true)
        pushToast({ title: t('digest.subscribed') })
      } else {
        pushToast({ title: t('digest.invalid') })
      }
    } finally {
      setBusy(false)
    }
  }

  const unsubscribe = async () => {
    setBusy(true)
    try {
      await fetch('/api/digest/subscribe', { method: 'DELETE' })
      setOptin(false)
      pushToast({ title: t('digest.unsubscribed') })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-1 flex items-center gap-3">
        <Mail className="h-5 w-5 text-accent" />
        <span className="font-medium">{t('digest.title')}</span>
        {optin && (
          <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">
            {t('digest.active')}
          </span>
        )}
      </div>
      <p className="mb-4 text-sm text-muted-foreground">{t('digest.desc')}</p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('digest.placeholder')}
          className="min-w-0 flex-1 rounded-full border border-border bg-background/40 px-4 py-1.5 text-sm outline-none focus:border-accent"
        />
        <Button size="sm" onClick={subscribe} disabled={busy || !email.trim()}>
          {optin ? t('digest.update') : t('digest.subscribe')}
        </Button>
        {optin && (
          <Button size="sm" variant="outline" onClick={unsubscribe} disabled={busy}>
            {t('digest.unsubscribe')}
          </Button>
        )}
      </div>
    </div>
  )
}
