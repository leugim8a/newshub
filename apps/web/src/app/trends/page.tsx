'use client'

import { ExternalLink, Flame, Settings, TrendingUp } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import ShinyText from '@/components/ShinyText'
import { Badge } from '@/components/ui/badge'
import { relativeTime, useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils/cn'

type Trend = {
  id: number
  label: string
  size: number
  source_count: number
  last_seen: string
  top_title: string | null
  top_url: string | null
  top_image: string | null
  source_name: string | null
}
type Ext = { title: string; url: string; info?: string }
type Topic = { slug: string; label: string; kind: string }

const EXT_SOURCES = ['wikipedia', 'mastodon', 'google'] as const
type ExtSource = (typeof EXT_SOURCES)[number]

type TrendPrefs = {
  trendSources?: Record<ExtSource, boolean>
  trendsRail?: boolean
  trendWindow?: number
  trendMin?: number
}

export default function TrendsPage() {
  const { t, lang } = useI18n()
  const [trends, setTrends] = useState<Trend[]>([])
  const [external, setExternal] = useState<Record<string, Ext[]>>({})
  const [topics, setTopics] = useState<Topic[]>([])
  const [topic, setTopic] = useState('')
  const [configOpen, setConfigOpen] = useState(false)

  const [sources, setSources] = useState<Record<ExtSource, boolean>>({
    wikipedia: true,
    mastodon: true,
    google: true,
  })
  const [rail, setRail] = useState(true)
  const [window, setWindow] = useState(12)
  const [min, setMin] = useState(2)

  // Cargar prefs del perfil.
  useEffect(() => {
    fetch('/api/profile')
      .then((r) => r.json())
      .then((d: { prefs?: TrendPrefs }) => {
        const p = d.prefs ?? {}
        if (p.trendSources) setSources({ ...{ wikipedia: true, mastodon: true, google: true }, ...p.trendSources })
        if (typeof p.trendsRail === 'boolean') setRail(p.trendsRail)
        if (p.trendWindow) setWindow(p.trendWindow)
        if (p.trendMin) setMin(p.trendMin)
      })
      .catch(() => {})
    fetch('/api/topics')
      .then((r) => r.json())
      .then((d: { topics: Topic[] }) => setTopics(d.topics))
  }, [])

  const savePrefs = (patch: TrendPrefs) => {
    fetch('/api/profile', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prefs: patch }),
    }).catch(() => {})
  }

  const loadOurs = useCallback(() => {
    const qs = new URLSearchParams({ window: String(window), min: String(min) })
    if (topic) qs.set('topic', topic)
    fetch(`/api/trends?${qs}`)
      .then((r) => r.json())
      .then((d: { trends: Trend[] }) => setTrends(d.trends))
  }, [window, min, topic])

  const loadExternal = useCallback(() => {
    const enabled = EXT_SOURCES.filter((s) => sources[s])
    if (enabled.length === 0) {
      setExternal({})
      return
    }
    fetch(`/api/trends/external?lang=${lang}&sources=${enabled.join(',')}`)
      .then((r) => r.json())
      .then((d: Record<string, Ext[]>) => setExternal(d))
      .catch(() => {})
  }, [sources, lang])

  useEffect(() => {
    loadOurs()
  }, [loadOurs])
  useEffect(() => {
    loadExternal()
  }, [loadExternal])

  const toggleSource = (s: ExtSource) => {
    const next = { ...sources, [s]: !sources[s] }
    setSources(next)
    savePrefs({ trendSources: next })
  }
  const setRailPref = (v: boolean) => {
    setRail(v)
    savePrefs({ trendsRail: v })
  }
  const setWindowPref = (v: number) => {
    setWindow(v)
    savePrefs({ trendWindow: v })
  }
  const setMinPref = (v: number) => {
    setMin(v)
    savePrefs({ trendMin: v })
  }

  const sourceLabel: Record<ExtSource, string> = {
    wikipedia: t('source.wikipedia'),
    mastodon: t('source.mastodon'),
    google: t('source.google'),
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="mb-1 flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <TrendingUp className="h-6 w-6 text-accent" />
            <ShinyText text={t('trends.title')} />
          </h1>
          <p className="text-sm text-muted-foreground">{t('trends.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={() => setConfigOpen((o) => !o)}
          title={t('trends.config')}
          className={cn(
            'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
            configOpen
              ? 'border-accent bg-accent/15 text-accent'
              : 'border-border text-muted-foreground hover:text-foreground',
          )}
        >
          <Settings className="h-4 w-4" />
          {t('trends.config')}
        </button>
      </header>

      {/* Panel de configuración */}
      {configOpen && (
        <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">{t('trends.window')}</span>
              <select
                value={window}
                onChange={(e) => setWindowPref(Number(e.target.value))}
                className="h-9 rounded-full border border-input bg-background px-3 text-sm outline-none focus:border-accent"
              >
                {[6, 12, 24, 48].map((w) => (
                  <option key={w} value={w}>
                    {w}h
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">{t('trends.min')}</span>
              <select
                value={min}
                onChange={(e) => setMinPref(Number(e.target.value))}
                className="h-9 rounded-full border border-input bg-background px-3 text-sm outline-none focus:border-accent"
              >
                {[2, 3, 4, 5].map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={rail}
                onChange={(e) => setRailPref(e.target.checked)}
                className="h-4 w-4 accent-[hsl(var(--accent))]"
              />
              <span>{t('trends.rail')}</span>
            </label>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('trends.extSources')}
            </p>
            <div className="flex flex-wrap gap-3">
              {EXT_SOURCES.map((s) => (
                <label key={s} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={sources[s]}
                    onChange={() => toggleSource(s)}
                    className="h-4 w-4 accent-[hsl(var(--accent))]"
                  />
                  <span>{sourceLabel[s]}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filtro por tema (para nuestras tendencias) */}
      <div className="mb-6 flex items-center gap-2">
        <select
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          className="h-9 rounded-full border border-input bg-background px-3 text-sm outline-none focus:border-accent"
        >
          <option value="">{t('trends.allTopics')}</option>
          {topics.map((tp) => (
            <option key={tp.slug} value={tp.slug}>
              #{tp.label}
            </option>
          ))}
        </select>
      </div>

      {/* Nuestras tendencias (cobertura por clustering) */}
      <Section title={t('trends.ours')}>
        {trends.length === 0 ? (
          <Empty text={t('trends.empty')} />
        ) : (
          trends.map((tr, i) => (
            <a
              key={tr.id}
              href={tr.top_url || '#'}
              target="_blank"
              rel="noreferrer"
              className="group flex gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-accent/40"
            >
              <div className="flex w-7 shrink-0 flex-col items-center pt-0.5">
                <span className="text-lg font-bold text-accent">{i + 1}</span>
                {tr.source_count >= 3 && <Flame className="mt-1 h-4 w-4 text-accent" />}
              </div>
              {tr.top_image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={tr.top_image} alt="" className="hidden h-16 w-24 shrink-0 rounded-lg object-cover sm:block" loading="lazy" />
              )}
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge className="border-accent/30 text-accent">
                    {tr.source_count >= 2 ? `${tr.source_count} ${t('trends.sources')}` : `${tr.size} ${t('trends.articles')}`}
                  </Badge>
                  <span>·</span>
                  <span>{relativeTime(tr.last_seen, lang)}</span>
                </div>
                <h3 className="line-clamp-2 font-medium leading-snug text-card-foreground group-hover:text-accent">
                  {tr.top_title ?? tr.label}
                </h3>
              </div>
            </a>
          ))
        )}
      </Section>

      {/* Fuentes externas */}
      {EXT_SOURCES.filter((s) => sources[s]).map((s) => (
        <Section key={s} title={sourceLabel[s]}>
          {(external[s] ?? []).length === 0 ? (
            <Empty text="…" />
          ) : (
            <ol className="flex flex-col gap-1.5 rounded-2xl border border-border bg-card p-3">
              {(external[s] ?? []).map((it, i) => (
                <a
                  key={`${s}-${i}`}
                  href={it.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-baseline gap-2 rounded px-2 py-1.5 transition-colors hover:bg-muted/40"
                >
                  <span className="w-5 shrink-0 text-sm font-bold text-accent">{i + 1}</span>
                  <span className="flex-1 text-sm transition-colors group-hover:text-accent">
                    {it.title}
                  </span>
                  {it.info && <span className="shrink-0 text-xs text-muted-foreground">{it.info}</span>}
                  <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" />
                </a>
              ))}
            </ol>
          )}
        </Section>
      ))}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 border-b border-border pb-2 text-sm font-semibold uppercase tracking-wide text-accent">
        {title}
      </h2>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  )
}

function Empty({ text }: { text: string }) {
  return (
    <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
      {text}
    </p>
  )
}
