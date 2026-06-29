'use client'

import { ChevronDown, Loader2, Pencil, Plus, Rss, Search, Trash2 } from 'lucide-react'
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

const BUILTIN_ORDER = ['actualidad', 'tech', 'divulgadores', 'cocina', 'estetica', 'sociedad']

type SectionOption = { key: string; label: string }

// El grupo elegido a partir del select de sección.
function groupFrom(value: string, newValue: string): string | null {
  if (value === '__new__') return newValue.trim() || null
  return value || null
}

export default function TopicsPage() {
  const { t } = useI18n()
  const [topics, setTopics] = useState<Topic[]>([])
  const [name, setName] = useState('')
  const [keywords, setKeywords] = useState('')
  const [section, setSection] = useState('')
  const [newSection, setNewSection] = useState('')
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
      body: JSON.stringify({ label: name.trim(), keywords: kws, group: groupFrom(section, newSection) }),
    })
    setName('')
    setKeywords('')
    setSection('')
    setNewSection('')
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

  const builtinLabels: Record<string, string> = {
    actualidad: t('group.actualidad'),
    tech: t('group.tech'),
    sociedad: t('group.sociedad'),
    divulgadores: t('group.divulgadores'),
    cocina: t('group.cocina'),
    estetica: t('group.estetica'),
    custom: t('topics.custom'),
    general: t('feed.general'),
  }
  const labelOf = (key: string) => builtinLabels[key] ?? key
  const sectionKeyOf = (tp: Topic) =>
    tp.topic_group ?? (tp.kind === 'custom' ? 'custom' : 'general')

  // Secciones de usuario existentes (para el selector).
  const userSections = [
    ...new Set(
      topics
        .map((x) => x.topic_group)
        .filter((g): g is string => !!g && !BUILTIN_ORDER.includes(g)),
    ),
  ].sort()
  const sectionOptions: SectionOption[] = [
    ...BUILTIN_ORDER.map((k) => ({ key: k, label: labelOf(k) })),
    ...userSections.map((k) => ({ key: k, label: k })),
  ]

  // Orden de secciones a renderizar: builtins, secciones de usuario, Tus temas, Otras.
  const present = [...new Set(topics.map(sectionKeyOf))]
  const orderedKeys = [
    ...BUILTIN_ORDER.filter((k) => present.includes(k)),
    ...userSections.filter((k) => present.includes(k)),
    ...(present.includes('custom') ? ['custom'] : []),
    ...(present.includes('general') ? ['general'] : []),
  ]

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="mb-8 text-2xl font-semibold tracking-tight">
        <ShinyText text={t('topics.title')} />
      </h1>

      {/* Crear tema propio */}
      <section className="mb-10 rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-3 text-sm font-semibold text-accent">{t('topics.create')}</h2>
        <div className="flex flex-col gap-3">
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
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <SectionPicker
              value={section}
              newValue={newSection}
              onValue={setSection}
              onNewValue={setNewSection}
              options={sectionOptions}
            />
            <Button onClick={create} disabled={busy} className="sm:ml-auto">
              <Plus className="h-4 w-4" />
              {t('topics.add')}
            </Button>
          </div>
        </div>
      </section>

      {/* Temas agrupados por sección */}
      {orderedKeys.map((key) => {
        const items = topics.filter((tp) => sectionKeyOf(tp) === key)
        if (items.length === 0) return null
        return (
          <Group key={key} title={labelOf(key)} count={items.length}>
            {items.map((tp) => (
              <TopicRow
                key={tp.slug}
                tp={tp}
                onToggle={toggle}
                onRemove={tp.kind === 'custom' ? remove : undefined}
                onSearched={load}
                onEdited={tp.kind === 'custom' ? load : undefined}
                sectionOptions={sectionOptions}
              />
            ))}
          </Group>
        )
      })}
    </div>
  )
}

function SectionPicker({
  value,
  newValue,
  onValue,
  onNewValue,
  options,
}: {
  value: string
  newValue: string
  onValue: (v: string) => void
  onNewValue: (v: string) => void
  options: SectionOption[]
}) {
  const { t } = useI18n()
  return (
    <div className="flex flex-1 gap-2">
      <select
        value={value}
        onChange={(e) => onValue(e.target.value)}
        className="h-10 rounded-full border border-input bg-background px-4 text-sm outline-none focus:border-accent"
        aria-label={t('topics.section')}
      >
        <option value="">{t('topics.custom')}</option>
        {options.map((o) => (
          <option key={o.key} value={o.key}>
            {o.label}
          </option>
        ))}
        <option value="__new__">＋ {t('topics.newSection')}</option>
      </select>
      {value === '__new__' && (
        <input
          value={newValue}
          onChange={(e) => onNewValue(e.target.value)}
          placeholder={t('topics.sectionName')}
          className="h-10 flex-1 rounded-full border border-input bg-background px-4 text-sm outline-none focus:border-accent"
        />
      )}
    </div>
  )
}

function Group({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
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
  sectionOptions,
}: {
  tp: Topic
  onToggle: (slug: string, followed: boolean) => void
  onRemove?: (slug: string) => void
  onSearched?: () => void
  onEdited?: () => void
  sectionOptions: SectionOption[]
}) {
  const { t } = useI18n()
  const [searching, setSearching] = useState(false)
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const [sourceUrl, setSourceUrl] = useState('')
  const [addingSource, setAddingSource] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editLabel, setEditLabel] = useState(tp.label)
  const [editKeywords, setEditKeywords] = useState((tp.keywords ?? []).join(', '))
  const initialSection =
    tp.topic_group && sectionOptions.some((o) => o.key === tp.topic_group) ? tp.topic_group : ''
  const [editSection, setEditSection] = useState(initialSection)
  const [editNewSection, setEditNewSection] = useState('')
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

  const addSource = async (url: string, name?: string) => {
    const u = url.trim()
    if (!u) return
    setAddingSource(true)
    try {
      const res = await fetch('/api/topics/sources', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug: tp.slug, url: u, name }),
      })
      const d = (await res.json()) as { ok?: boolean; via?: string; tagged?: number }
      if (d.ok) {
        pushToast({ title: `${t('topics.sourceAdded')} (${d.via})`, body: `#${tp.label}` })
        setSourceUrl('')
        onSearched?.()
      } else {
        pushToast({ title: t('topics.sourceFail') })
      }
    } catch {
      pushToast({ title: t('topics.sourceFail') })
    } finally {
      setAddingSource(false)
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
      body: JSON.stringify({
        slug: tp.slug,
        label: editLabel.trim(),
        keywords: kws,
        group: groupFrom(editSection, editNewSection),
      }),
    })
    setBusy(false)
    setEditing(false)
    onEdited?.()
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-2 rounded-2xl border border-accent/40 bg-card p-4">
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
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <SectionPicker
            value={editSection}
            newValue={editNewSection}
            onValue={setEditSection}
            onNewValue={setEditNewSection}
            options={sectionOptions}
          />
          <Button onClick={saveEdit} disabled={busy} className="sm:ml-auto">
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
    <div className="rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between p-4">
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
            onClick={() => setSourcesOpen((v) => !v)}
            title={t('topics.sources')}
            className={sourcesOpen ? 'border-accent text-accent' : ''}
          >
            <Rss className="h-4 w-4" />
            <span className="hidden sm:inline">{t('topics.sources')}</span>
          </Button>
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

      {sourcesOpen && (
        <div className="border-t border-border p-4">
          {/* Añadir fuente manual: pega una URL de YouTube, RSS o web (descubre su RSS). */}
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addSource(sourceUrl)}
              placeholder={t('topics.addSourcePh')}
              className="h-10 flex-1 rounded-full border border-input bg-background px-4 text-sm outline-none focus:border-accent"
            />
            <Button onClick={() => addSource(sourceUrl)} disabled={addingSource || !sourceUrl.trim()} size="sm">
              {addingSource ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {t('topics.add2')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
