'use client'

import { Plus, Rss, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import ShinyText from '@/components/ShinyText'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { pushToast } from '@/components/Toaster'
import { useI18n } from '@/lib/i18n'

type Source = {
  id: number
  name: string
  url: string
  lang: string
  active: boolean
  article_count: number
}

export default function SourcesPage() {
  const { t } = useI18n()
  const [sources, setSources] = useState<Source[]>([])
  const [url, setUrl] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () =>
    fetch('/api/sources')
      .then((r) => r.json())
      .then((d: { sources: Source[] }) => setSources(d.sources))

  useEffect(() => {
    load()
  }, [])

  const add = async () => {
    if (!url.trim()) return
    setBusy(true)
    const res = await fetch('/api/sources', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: url.trim(), name: name.trim() || undefined }),
    })
    const d = await res.json()
    setBusy(false)
    if (!res.ok) {
      pushToast({ title: t('sources.invalid'), body: d.error })
      return
    }
    pushToast({ title: t('sources.added'), body: `${d.name} · ${d.items} items` })
    setUrl('')
    setName('')
    load()
  }

  const toggle = async (s: Source) => {
    setSources((xs) => xs.map((x) => (x.id === s.id ? { ...x, active: !x.active } : x)))
    await fetch('/api/sources', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: s.id, active: !s.active }),
    })
  }

  const remove = async (id: number) => {
    setSources((xs) => xs.filter((x) => x.id !== id))
    await fetch('/api/sources', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id }),
    })
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-8">
        <h1 className="mb-1 flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Rss className="h-6 w-6 text-accent" />
          <ShinyText text={t('sources.title')} />
        </h1>
        <p className="text-sm text-muted-foreground">{t('sources.subtitle')}</p>
      </header>

      <section className="mb-8 rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-3 text-sm font-semibold text-accent">{t('sources.add')}</h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={t('sources.url')}
            className="h-10 flex-[2] rounded-full border border-input bg-background px-4 text-sm outline-none focus:border-accent"
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('sources.name')}
            className="h-10 flex-1 rounded-full border border-input bg-background px-4 text-sm outline-none focus:border-accent"
          />
          <Button onClick={add} disabled={busy || !url.trim()}>
            <Plus className="h-4 w-4" />
            {t('sources.add')}
          </Button>
        </div>
      </section>

      {sources.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {t('sources.empty')}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {sources.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{s.name}</p>
                <p className="truncate text-xs text-muted-foreground">{s.url}</p>
                <div className="mt-1 flex items-center gap-2">
                  <Badge>{s.article_count} {t('trends.articles')}</Badge>
                  <Badge className="uppercase">{s.lang}</Badge>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  variant={s.active ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => toggle(s)}
                >
                  {s.active ? t('sources.active') : t('sources.paused')}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => remove(s.id)} title={t('topics.delete')}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
