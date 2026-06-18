'use client'

import { Bell, BellRing, BellOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n'
import { enablePush, pushStatus } from '@/lib/push-client'

export function NotificationBell() {
  const { t } = useI18n()
  const [status, setStatus] = useState<'enabled' | 'default' | 'blocked' | 'unsupported'>('default')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    pushStatus().then(setStatus)
  }, [])

  const onClick = async () => {
    if (status === 'enabled' || status === 'blocked' || status === 'unsupported') return
    setBusy(true)
    setStatus(await enablePush())
    setBusy(false)
  }

  const label =
    status === 'enabled'
      ? t('push.enabled')
      : status === 'blocked'
        ? t('push.blocked')
        : status === 'unsupported'
          ? t('push.unsupported')
          : t('push.enable')

  const Icon = status === 'enabled' ? BellRing : status === 'blocked' ? BellOff : Bell

  return (
    <Button
      variant={status === 'enabled' ? 'secondary' : 'default'}
      size="sm"
      onClick={onClick}
      disabled={busy || status === 'blocked' || status === 'unsupported'}
      title={label}
    >
      <Icon className="h-4 w-4" />
      <span className="hidden sm:inline">{label}</span>
    </Button>
  )
}
