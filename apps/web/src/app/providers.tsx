'use client'

import { useEffect, type ReactNode } from 'react'
import { I18nProvider } from '@/lib/i18n'
import { Toaster, pushToast } from '@/components/Toaster'

// Escucha SSE global: cualquier novedad ingerida se muestra como toast.
function RealtimeListener() {
  useEffect(() => {
    const es = new EventSource('/api/events')
    es.onmessage = (e) => {
      try {
        const ev = JSON.parse(e.data) as { title: string; body?: string; url?: string }
        pushToast(ev)
      } catch {
        /* ignore */
      }
    }
    return () => es.close()
  }, [])
  return null
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
      {children}
      <RealtimeListener />
      <Toaster />
    </I18nProvider>
  )
}
