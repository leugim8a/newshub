'use client'

import { AlignJustify, ImageIcon, LayoutGrid, Newspaper } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { ArticleCard, type Article } from '@/components/ArticleCard'
import { NotificationBell } from '@/components/NotificationBell'
import { HeadlineCard, LeadCard, TitularRow, TrendsRail } from '@/components/Portada'
import ShinyText from '@/components/ShinyText'
import { pushToast } from '@/components/Toaster'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils/cn'

type Topic = { slug: string; label: string; followed: boolean; article_count: number }
type View = 'portada' | 'cards' | 'headlines' | 'mosaic'

const VIEWS: { id: View; icon: typeof Newspaper; labelKey: 'view.portada' | 'view.cards' | 'view.headlines' | 'view.mosaic' }[] = [
  { id: 'portada', icon: Newspaper, labelKey: 'view.portada' },
  { id: 'cards', icon: ImageIcon, labelKey: 'view.cards' },
  { id: 'headlines', icon: AlignJustify, labelKey: 'view.headlines' },
  { id: 'mosaic', icon: LayoutGrid, labelKey: 'view.mosaic' },
]

export function FeedClient() {
  const { t, lang, setLang } = useI18n()
  const [articles, setArticles] = useState<Article[]>([])
  const [topics, setTopics] = useState<Topic[]>([])
  const [active, setActive] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>('portada')

  useEffect(() => {
    const saved = localStorage.getItem('newshub.view') as View | null
    if (saved) setView(saved)
  }, [])

  const changeView = (v: View) => {
    setView(v)
    localStorage.setItem('newshub.view', v)
  }

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

  const wide = view === 'portada' || view === 'mosaic'

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

      {/* Filtros + selector de vista */}
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
        <div className="ml-auto flex items-center gap-1 rounded-full border border-border p-0.5">
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

      {loading ? (
        <p className="text-sm text-muted-foreground">…</p>
      ) : articles.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {t('feed.empty')}
        </p>
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
      ) : view === 'headlines' ? (
        <div className="rounded-2xl border border-border bg-card px-3 py-1.5">
          {articles.map((a) => (
            <TitularRow key={a.id} article={a} onDiscard={discard} />
          ))}
        </div>
      ) : view === 'mosaic' ? (
        <div className="gap-3 [column-fill:balance] sm:columns-2 lg:columns-3 [&>*]:mb-3 [&>*]:break-inside-avoid">
          {articles.map((a) => (
            <ArticleCard key={a.id} article={a} onDiscard={discard} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {articles.map((a) => (
            <ArticleCard key={a.id} article={a} onDiscard={discard} />
          ))}
        </div>
      )}
    </div>
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
