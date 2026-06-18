'use client'

import { ExternalLink, TrendingUp, Flame } from 'lucide-react'
import { useEffect, useState } from 'react'
import ShinyText from '@/components/ShinyText'
import { Badge } from '@/components/ui/badge'
import { relativeTime, useI18n } from '@/lib/i18n'

type Trend = {
  id: number
  label: string
  size: number
  source_count: number
  score_trend: number
  last_seen: string
  top_title: string | null
  top_url: string | null
  top_image: string | null
  source_name: string | null
}

export default function TrendsPage() {
  const { t, lang } = useI18n()
  const [trends, setTrends] = useState<Trend[]>([])
  const [loading, setLoading] = useState(true)

  const load = () =>
    fetch('/api/trends')
      .then((r) => r.json())
      .then((d: { trends: Trend[] }) => {
        setTrends(d.trends)
        setLoading(false)
      })

  useEffect(() => {
    load()
    const es = new EventSource('/api/events')
    es.onmessage = () => load()
    return () => es.close()
  }, [])

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-8">
        <h1 className="mb-1 flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <TrendingUp className="h-6 w-6 text-accent" />
          <ShinyText text={t('trends.title')} />
        </h1>
        <p className="text-sm text-muted-foreground">{t('trends.subtitle')}</p>
      </header>

      {loading ? (
        <p className="text-sm text-muted-foreground">…</p>
      ) : trends.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {t('trends.empty')}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {trends.map((tr, i) => (
            <a
              key={tr.id}
              href={tr.top_url || '#'}
              target="_blank"
              rel="noreferrer"
              className="group flex gap-4 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-accent/40"
            >
              <div className="flex w-8 shrink-0 flex-col items-center pt-1">
                <span className="text-lg font-bold text-accent">{i + 1}</span>
                {tr.source_count >= 3 && <Flame className="mt-1 h-4 w-4 text-accent" />}
              </div>
              {tr.top_image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={tr.top_image}
                  alt=""
                  className="hidden h-20 w-28 shrink-0 rounded-xl object-cover sm:block"
                  loading="lazy"
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="mb-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge className="border-accent/30 text-accent">
                    {tr.source_count} {t('trends.sources')}
                  </Badge>
                  <span>·</span>
                  <span>
                    {tr.size} {t('trends.articles')}
                  </span>
                  <span>·</span>
                  <span>{relativeTime(tr.last_seen, lang)}</span>
                  <ExternalLink className="ml-auto h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
                <h3 className="line-clamp-2 font-medium leading-snug text-card-foreground">
                  {tr.top_title ?? tr.label}
                </h3>
                {tr.source_name && (
                  <p className="mt-1 text-xs text-muted-foreground">{tr.source_name}</p>
                )}
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
