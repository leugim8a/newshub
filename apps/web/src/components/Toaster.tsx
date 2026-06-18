'use client'

// Toaster mínimo con store externo (sin dependencias). Estilo voicebox.
import { useSyncExternalStore } from 'react'
import { Radio, X } from 'lucide-react'

type Toast = { id: number; title: string; body?: string; url?: string }

let toasts: Toast[] = []
let nextId = 1
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function pushToast(t: Omit<Toast, 'id'>): void {
  const id = nextId++
  toasts = [{ id, ...t }, ...toasts].slice(0, 4)
  emit()
  setTimeout(() => {
    toasts = toasts.filter((x) => x.id !== id)
    emit()
  }, 8000)
}

function dismiss(id: number) {
  toasts = toasts.filter((x) => x.id !== id)
  emit()
}

export function Toaster() {
  const list = useSyncExternalStore(
    subscribe,
    () => toasts,
    () => toasts,
  )

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex w-80 flex-col gap-3">
      {list.map((t) => (
        <a
          key={t.id}
          href={t.url || '#'}
          target={t.url ? '_blank' : undefined}
          rel="noreferrer"
          className="animate-fade-in-scale pointer-events-auto block rounded-2xl border border-border bg-card/95 p-4 shadow-2xl backdrop-blur"
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
              <Radio className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              {t.body && (
                <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-accent">{t.body}</p>
              )}
              <p className="line-clamp-2 text-sm text-card-foreground">{t.title}</p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                dismiss(t.id)
              }}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </a>
      ))}
    </div>
  )
}
