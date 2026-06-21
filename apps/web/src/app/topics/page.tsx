'use client'

import { ChevronDown, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import ShinyText from '@/components/ShinyText'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { pushToast } from '@/components/Toaster'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils/cn'

type Topic = {
  slug: string
  label: string
  kind: 'curated' | 'custom'
  followed: boolean
  article_count: number
  keywords?: string[]
  topic_group?: string | null
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

  const custom = topics.filter((x) => x.kind === 'custom')
  const inGroup = (g: string) => topics.filter((x) => x.kind === 'curated' && x.topic_group === g)
  const ungrouped = topics.filter((x) => x.kind === 'curated' && !x.topic_group)
  const curatedGroups = [
    { key: 'actualidad', label: t('group.actualidad'), items: inGroup('actualidad') },
    { key: 'tech', label: t('group.tech'), items: inGroup('tech') },
    { key: 'sociedad', label: t('group.sociedad'), items: inGroup('sociedad') },
    { key: 'otros', label: t('topics.curated'), items: ungrouped },
  ].filter((g) => g.items.length > 0)

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
      <Group title={t('topics.custom')} count={custom.length}>
        {custom.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            {t('topics.customEmpty')}
          </p>
        ) : (
          custom.map((tp) => (
            <TopicRow
              key={tp.slug}
              tp={tp}
              onToggle={toggle}
              onRemove={remove}
              onSearched={load}
              onEdited={load}
            />
          ))
        )}
      </Group>

      {/* Categorías curadas, agrupadas */}
      {curatedGroups.map((g) => (
        <Group key={g.key} title={g.label} count={g.items.length}>
          {g.items.map((tp) => (
            <TopicRow key={tp.slug} tp={tp} onToggle={toggle} onSearched={load} />
          ))}
        </Group>
      ))}
    </div>
  )
}

function Group({
  title,
  count,
  children,
}: {
  title: string
  count?: number
  children: ReactNode
}) {
  const [open, setOpen] = useState(true)
  return (
    <section className="mb-6">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="mb-3 flex w-full items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronDown className={cn('h-4 w-4 transition-transform', !open && '-rotate-90')} />
        <span>{title}</span>
        {count != null && <span className="text-xs font-normal opacity-70">({count})</span>}
      </button>
      {open && <div className="flex flex-col gap-3">{children}</div>}
    </section>
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
