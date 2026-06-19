'use client'

import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import ShinyText from '@/components/ShinyText'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { pushToast } from '@/components/Toaster'
import { useI18n } from '@/lib/i18n'

type Topic = {
  slug: string
  label: string
  kind: 'curated' | 'custom'
  followed: boolean
  article_count: number
  keywords?: string[]
}

export default function TopicsPage() {
  const { t } = useI18n()
  const [topics, setTopics] = useState<Topic[]>([])
  const [name, setName] = useState('')
  const [keywords, setKeywords] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () =>
    fetch('/api/topics')
      .then((r) => r.json())
      .then((d: { topics: Topic[] }) => setTopics(d.topics))

  useEffect(() => {
    load()
  }, [])

  const toggle = async (slug: string, followed: boolean) => {
    setTopics((ts) => ts.map((x) => (x.slug === slug ? { ...x, followed } : x)))
    await fetch('/api/topics', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug, followed }),
    })
  }

  const create = async () => {
    const kws = keywords
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean)
    if (!name.trim() || kws.length === 0) return
    setBusy(true)
    await fetch('/api/topics', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ label: name.trim(), keywords: kws }),
    })
    setName('')
    setKeywords('')
    setBusy(false)
    load()
  }

  const remove = async (slug: string) => {
    setTopics((ts) => ts.filter((x) => x.slug !== slug))
    await fetch('/api/topics', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug }),
    })
  }

  const curated = topics.filter((x) => x.kind === 'curated')
  const custom = topics.filter((x) => x.kind === 'custom')

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="mb-8 text-2xl font-semibold tracking-tight">
        <ShinyText text={t('topics.title')} />
      </h1>

      {/* Crear tema propio */}
      <section className="mb-10 rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-3 text-sm font-semibold text-accent">{t('topics.create')}</h2>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('topics.name')}
            className="h-10 flex-1 rounded-full border border-input bg-background px-4 text-sm outline-none focus:border-accent"
          />
          <input
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder={t('topics.keywords')}
            className="h-10 flex-[2] rounded-full border border-input bg-background px-4 text-sm outline-none focus:border-accent"
          />
          <Button onClick={create} disabled={busy}>
            <Plus className="h-4 w-4" />
            {t('topics.add')}
          </Button>
        </div>
      </section>

      {/* Tus temas */}
      <section className="mb-10">
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">{t('topics.custom')}</h2>
        {custom.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            {t('topics.customEmpty')}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {custom.map((tp) => (
              <TopicRow
                key={tp.slug}
                tp={tp}
                onToggle={toggle}
                onRemove={remove}
                onSearched={load}
                onEdited={load}
              />
            ))}
          </div>
        )}
      </section>

      {/* Categorías curadas */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">{t('topics.curated')}</h2>
        <div className="flex flex-col gap-3">
          {curated.map((tp) => (
            <TopicRow key={tp.slug} tp={tp} onToggle={toggle} onSearched={load} />
          ))}
        </div>
      </section>
    </div>
  )
}

function TopicRow({
  tp,
  onToggle,
  onRemove,
  onSearched,
  onEdited,
}: {
  tp: Topic
  onToggle: (slug: string, followed: boolean) => void
  onRemove?: (slug: string) => void
  onSearched?: () => void
  onEdited?: () => void
}) {
  const { t } = useI18n()
  const [searching, setSearching] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editLabel, setEditLabel] = useState(tp.label)
  const [editKeywords, setEditKeywords] = useState((tp.keywords ?? []).join(', '))
  const [busy, setBusy] = useState(false)

  const search = async () => {
    setSearching(true)
    try {
      const res = await fetch('/api/topics/search', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug: tp.slug }),
      })
      const d = (await res.json()) as { total: number; relevant: number | null }
      pushToast({
        title: `#${tp.label}: ${d.total} ${t('topics.searchResult')}`,
        body: d.relevant != null ? `+${d.relevant} ${t('topics.searchResult')}` : undefined,
      })
      onSearched?.()
    } catch {
      /* noop */
    } finally {
      setSearching(false)
    }
  }

  const saveEdit = async () => {
    const kws = editKeywords
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean)
    if (!editLabel.trim() || kws.length === 0) return
    setBusy(true)
    await fetch('/api/topics', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug: tp.slug, label: editLabel.trim(), keywords: kws }),
    })
    setBusy(false)
    setEditing(false)
    onEdited?.()
  }

  if (editing) {
    return (
      <div className="rounded-2xl border border-accent/40 bg-card p-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={editLabel}
            onChange={(e) => setEditLabel(e.target.value)}
            placeholder={t('topics.name')}
            className="h-10 flex-1 rounded-full border border-input bg-background px-4 text-sm outline-none focus:border-accent"
          />
          <input
            value={editKeywords}
            onChange={(e) => setEditKeywords(e.target.value)}
            placeholder={t('topics.keywords')}
            className="h-10 flex-[2] rounded-full border border-input bg-background px-4 text-sm outline-none focus:border-accent"
          />
          <Button onClick={saveEdit} disabled={busy}>
            {t('topics.add')}
          </Button>
          <Button variant="ghost" onClick={() => setEditing(false)} disabled={busy}>
            {t('common.undo')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-4">
      <div>
        <p className="font-medium">#{tp.label}</p>
        <Badge className="mt-1">
          {tp.article_count} {t('trends.articles')}
        </Badge>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={search}
          disabled={searching}
          title={t('topics.search')}
        >
          <Search className="h-4 w-4" />
          <span className="hidden sm:inline">
            {searching ? t('topics.searching') : t('topics.search')}
          </span>
        </Button>
        <Button
          variant={tp.followed ? 'secondary' : 'default'}
          size="sm"
          onClick={() => onToggle(tp.slug, !tp.followed)}
        >
          {tp.followed ? t('topics.following') : t('topics.follow')}
        </Button>
        {onEdited && (
          <Button variant="ghost" size="icon" onClick={() => setEditing(true)} title={t('topics.edit')}>
            <Pencil className="h-4 w-4" />
          </Button>
        )}
        {onRemove && (
          <Button variant="ghost" size="icon" onClick={() => onRemove(tp.slug)} title={t('topics.delete')}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
