'use client'

import {
  AlignJustify,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  GripVertical,
  ImageIcon,
  LayoutGrid,
  LayoutPanelTop,
  Newspaper,
} from 'lucide-react'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { ArticleCard, type Article } from '@/components/ArticleCard'
import { NotificationBell } from '@/components/NotificationBell'
import { HeadlineCard, LeadCard, TitularRow, TrendsRail } from '@/components/Portada'
import ShinyText from '@/components/ShinyText'
import { pushToast } from '@/components/Toaster'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils/cn'

type Topic = {
  slug: string
  label: string
  kind: 'curated' | 'custom'
  followed: boolean
  article_count: number
  topic_group?: string | null
}
type View = 'portada' | 'cards' | 'headlines' | 'mosaic'

const VIEWS: {
  id: View
  icon: typeof Newspaper
  labelKey: 'view.portada' | 'view.cards' | 'view.headlines' | 'view.mosaic'
}[] = [
  { id: 'portada', icon: Newspaper, labelKey: 'view.portada' },
  { id: 'cards', icon: ImageIcon, labelKey: 'view.cards' },
  { id: 'headlines', icon: AlignJustify, labelKey: 'view.headlines' },
  { id: 'mosaic', icon: LayoutGrid, labelKey: 'view.mosaic' },
]

const SECTION_ORDER = ['actualidad', 'tech', 'sociedad', 'custom', 'general'] as const
type SectionKey = (typeof SECTION_ORDER)[number]

type Prefs = {
  view?: View
  sectioned?: boolean
  sectionOrder?: SectionKey[]
  hidden?: SectionKey[]
}

// Asegura que el orden guardado contiene exactamente las secciones válidas.
function normalizeOrder(arr: unknown): SectionKey[] {
  const valid = Array.isArray(arr)
    ? (arr.filter((k) => (SECTION_ORDER as readonly string[]).includes(k)) as SectionKey[])
    : []
  const missing = SECTION_ORDER.filter((k) => !valid.includes(k))
  return [...valid, ...missing]
}

export function FeedClient() {
  const { t, lang, setLang } = useI18n()
  const [articles, setArticles] = useState<Article[]>([])
  const [topics, setTopics] = useState<Topic[]>([])
  const [active, setActive] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>('portada')
  const [sectioned, setSectioned] = useState(false)
  const [sectionOrder, setSectionOrder] = useState<SectionKey[]>([...SECTION_ORDER])
  const [hidden, setHidden] = useState<SectionKey[]>([])
  const [dragKey, setDragKey] = useState<SectionKey | null>(null)
  const [dragOver, setDragOver] = useState<SectionKey | null>(null)

  const applyPrefs = (p: Prefs) => {
    if (p.view) setView(p.view)
    if (typeof p.sectioned === 'boolean') setSectioned(p.sectioned)
    if (p.sectionOrder) setSectionOrder(normalizeOrder(p.sectionOrder))
    if (Array.isArray(p.hidden)) {
      setHidden(p.hidden.filter((k) => (SECTION_ORDER as readonly string[]).includes(k)) as SectionKey[])
    }
  }

  useEffect(() => {
    // 1) localStorage (instantáneo)
    try {
      const local = JSON.parse(localStorage.getItem('newshub.prefs') || 'null')
      if (local) applyPrefs(local)
    } catch {
      /* prefs corruptas → defaults */
    }
    // 2) perfil en BD (cross-device) sobrescribe si tiene prefs
    fetch('/api/profile')
      .then((r) => r.json())
      .then((d: { prefs?: Prefs }) => {
        if (d.prefs && Object.keys(d.prefs).length > 0) {
          applyPrefs(d.prefs)
          localStorage.setItem('newshub.prefs', JSON.stringify(d.prefs))
        }
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Persiste un set completo de prefs en localStorage y en el perfil (BD).
  const persist = (p: Prefs) => {
    localStorage.setItem('newshub.prefs', JSON.stringify(p))
    fetch('/api/profile', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prefs: p }),
    }).catch(() => {})
  }
  const snapshot = (over: Prefs): Prefs => ({ view, sectioned, sectionOrder, hidden, ...over })

  const changeView = (v: View) => {
    setView(v)
    persist(snapshot({ view: v }))
  }
  const toggleSections = () => {
    const ns = !sectioned
    setSectioned(ns)
    persist(snapshot({ sectioned: ns }))
  }
  const applyOrder = (next: SectionKey[]) => {
    setSectionOrder(next)
    persist(snapshot({ sectionOrder: next }))
  }
  const moveSection = (key: SectionKey, dir: -1 | 1, rendered: SectionKey[]) => {
    const i = rendered.indexOf(key)
    const j = i + dir
    if (j < 0 || j >= rendered.length) return
    const next = [...sectionOrder]
    const a = next.indexOf(key)
    const b = next.indexOf(rendered[j])
    ;[next[a], next[b]] = [next[b], next[a]]
    applyOrder(next)
  }
  const dropOn = (target: SectionKey) => {
    setDragOver(null)
    if (!dragKey || dragKey === target) return
    const next = sectionOrder.filter((k) => k !== dragKey)
    next.splice(next.indexOf(target), 0, dragKey)
    setDragKey(null)
    applyOrder(next)
  }
  const setHiddenP = (h: SectionKey[]) => {
    setHidden(h)
    persist(snapshot({ hidden: h }))
  }
  const hideSection = (key: SectionKey) => setHiddenP([...hidden, key])
  const showSection = (key: SectionKey) => setHiddenP(hidden.filter((k) => k !== key))

  const loadFeed = useCallback(async (sel: string | null) => {
    const url = sel === 'all' ? '/api/feed?all=1' : sel ? `/api/feed?topic=${sel}` : '/api/feed'
    const res = await fetch(url)
    const data = (await res.json()) as { articles: Article[] }
    setArticles(data.articles)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetch('/api/topics')
      .then((r) => r.json())
      .then((d: { topics: Topic[] }) => setTopics(d.topics))
  }, [])

  useEffect(() => {
    loadFeed(active)
  }, [active, loadFeed])

  useEffect(() => {
    const es = new EventSource('/api/events')
    es.onmessage = () => loadFeed(active)
    return () => es.close()
  }, [active, loadFeed])

  const discard = async (id: number) => {
    setArticles((arts) => arts.filter((a) => a.id !== id))
    await fetch('/api/feed/discard', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ articleId: id }),
    })
    pushToast({
      title: t('feed.discarded'),
      action: {
        label: t('common.undo'),
        run: async () => {
          await fetch('/api/feed/discard', {
            method: 'DELETE',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ articleId: id }),
          })
          loadFeed(active)
        },
      },
    })
  }

  // Renderiza un conjunto de artículos según el estilo de la vista.
  const renderItems = (arts: Article[]) => {
    if (arts.length === 0) return null
    if (view === 'headlines') {
      return (
        <div className="rounded-2xl border border-border bg-card px-3 py-1.5">
          {arts.map((a) => (
            <TitularRow key={a.id} article={a} onDiscard={discard} />
          ))}
        </div>
      )
    }
    if (view === 'mosaic') {
      return (
        <div className="gap-3 sm:columns-2 lg:columns-3 [&>*]:mb-3 [&>*]:break-inside-avoid">
          {arts.map((a) => (
            <ArticleCard key={a.id} article={a} onDiscard={discard} />
          ))}
        </div>
      )
    }
    if (view === 'cards') {
      return (
        <div className="flex flex-col gap-3">
          {arts.map((a) => (
            <ArticleCard key={a.id} article={a} onDiscard={discard} />
          ))}
        </div>
      )
    }
    // portada (dentro de secciones) → rejilla de titulares
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {arts.map((a) => (
          <HeadlineCard key={a.id} article={a} onDiscard={discard} />
        ))}
      </div>
    )
  }

  // Asigna cada artículo a una sección según el grupo de sus temas.
  const slugInfo = new Map(topics.map((tp) => [tp.slug, tp]))
  const sectionOf = (a: Article): SectionKey => {
    let custom = false
    for (const s of a.topics) {
      const info = slugInfo.get(s)
      if (info?.topic_group) return info.topic_group as SectionKey
      if (info && info.kind === 'custom') custom = true
    }
    return custom ? 'custom' : 'general'
  }
  const sectionLabel: Record<SectionKey, string> = {
    actualidad: t('group.actualidad'),
    tech: t('group.tech'),
    sociedad: t('group.sociedad'),
    custom: t('topics.custom'),
    general: t('feed.general'),
  }

  const showSections = sectioned && (active === null || active === 'all')
  const wide = view === 'portada' || view === 'mosaic' || showSections

  return (
    <div className={cn('mx-auto px-6 py-10', wide ? 'max-w-5xl' : 'max-w-3xl')}>
      <header className="mb-6">
        <div className="mb-2 flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">
            <ShinyText text={t('feed.title')} />
          </h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setLang(lang === 'es' ? 'en' : 'es')}
              className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              {lang.toUpperCase()}
            </button>
            <NotificationBell />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{t('feed.subtitle')}</p>
      </header>

      {/* Filtros + secciones + selector de vista */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Chip label={t('topics.following')} active={active === null} onClick={() => setActive(null)} />
        <Chip label={t('feed.all')} active={active === 'all'} onClick={() => setActive('all')} />
        {topics.map((tp) => (
          <Chip
            key={tp.slug}
            label={`#${tp.label}`}
            active={active === tp.slug}
            onClick={() => setActive(tp.slug)}
          />
        ))}
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={toggleSections}
            title={t('feed.sections')}
            aria-label={t('feed.sections')}
            className={cn(
              'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
              sectioned
                ? 'border-accent bg-accent/15 text-accent'
                : 'border-border text-muted-foreground hover:text-foreground',
            )}
          >
            <LayoutPanelTop className="h-4 w-4" />
            <span className="hidden sm:inline">{t('feed.sections')}</span>
          </button>
          <div className="flex items-center gap-1 rounded-full border border-border p-0.5">
            {VIEWS.map((v) => {
              const Icon = v.icon
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => changeView(v.id)}
                  title={t(v.labelKey)}
                  aria-label={t(v.labelKey)}
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full transition-colors',
                    view === v.id
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon className="h-4 w-4" />
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">…</p>
      ) : articles.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {t('feed.empty')}
        </p>
      ) : showSections ? (
        (() => {
          const itemsOf = (key: SectionKey) => articles.filter((a) => sectionOf(a) === key)
          const rendered = sectionOrder.filter((k) => !hidden.includes(k) && itemsOf(k).length > 0)
          // Todas las ocultas (aunque ahora no tengan artículos) para poder restaurarlas.
          const hiddenList = sectionOrder.filter((k) => hidden.includes(k))
          return (
            <div className="flex flex-col gap-8">
              {rendered.map((key, idx) => (
                <section
                  key={key}
                  onDragOver={(e) => {
                    e.preventDefault()
                    if (dragKey) setDragOver(key)
                  }}
                  onDragLeave={() => setDragOver((d) => (d === key ? null : d))}
                  onDrop={() => dropOn(key)}
                  className={cn(
                    'rounded-lg transition-shadow',
                    dragOver === key && dragKey && dragKey !== key
                      ? 'ring-2 ring-accent/50'
                      : '',
                  )}
                >
                  <div className="mb-3 flex items-center justify-between gap-2 border-b border-border pb-2">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span
                        draggable
                        onDragStart={() => setDragKey(key)}
                        onDragEnd={() => {
                          setDragKey(null)
                          setDragOver(null)
                        }}
                        title={t('feed.moveUp')}
                        className="cursor-grab text-muted-foreground/60 transition-colors hover:text-foreground active:cursor-grabbing"
                      >
                        <GripVertical className="h-4 w-4" />
                      </span>
                      <h2 className="truncate text-sm font-semibold uppercase tracking-wide text-accent">
                        {sectionLabel[key]}
                      </h2>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <SecBtn
                        title={t('feed.moveUp')}
                        disabled={idx === 0}
                        onClick={() => moveSection(key, -1, rendered)}
                      >
                        <ChevronUp className="h-4 w-4" />
                      </SecBtn>
                      <SecBtn
                        title={t('feed.moveDown')}
                        disabled={idx === rendered.length - 1}
                        onClick={() => moveSection(key, 1, rendered)}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </SecBtn>
                      <SecBtn title={t('feed.hideSection')} onClick={() => hideSection(key)}>
                        <EyeOff className="h-4 w-4" />
                      </SecBtn>
                    </div>
                  </div>
                  {renderItems(itemsOf(key))}
                </section>
              ))}

              {hiddenList.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
                  <span className="text-xs text-muted-foreground">{t('feed.hidden')}:</span>
                  {hiddenList.map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => showSection(key)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      {sectionLabel[key]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })()
      ) : view === 'portada' ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
          <div>
            <LeadCard article={articles[0]} onDiscard={discard} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {articles.slice(1).map((a) => (
                <HeadlineCard key={a.id} article={a} onDiscard={discard} />
              ))}
            </div>
          </div>
          <aside className="hidden lg:block">
            <TrendsRail />
          </aside>
        </div>
      ) : (
        renderItems(articles)
      )}
    </div>
  )
}

function SecBtn({
  title,
  disabled,
  onClick,
  children,
}: {
  title: string
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  )
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
        active
          ? 'border-accent bg-accent/15 text-accent'
          : 'border-border text-muted-foreground hover:text-foreground',
      )}
    >
      {label}
    </button>
  )
}
