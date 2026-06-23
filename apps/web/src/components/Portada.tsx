'use client'

import { ExternalLink, Flame, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Article } from '@/components/ArticleCard'
import { BiasBar } from '@/components/BiasBar'
import { CardActions } from '@/components/CardActions'
import { ClusterBadge } from '@/components/ClusterBadge'
import { relativeTime, useI18n } from '@/lib/i18n'

function DiscardButton({ id, onDiscard }: { id: number; onDiscard?: (id: number) => void }) {
  if (!onDiscard) return null
  return (
    <button
      type="button"
      aria-label="Descartar"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onDiscard(id)
      }}
      className="absolute right-2 top-2 z-20 flex h-6 w-6 items-center justify-center rounded-full border border-white/15 bg-black/45 text-white opacity-0 backdrop-blur-sm transition-opacity hover:bg-black/70 group-hover:opacity-100"
    >
      <X className="h-3.5 w-3.5" />
    </button>
  )
}

function Meta({ article }: { article: Article }) {
  const { lang } = useI18n()
  return (
    <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
      <span className="font-medium text-foreground/80">{article.source_name ?? 'Fuente'}</span>
      <span>·</span>
      <span>{relativeTime(article.published_at, lang)}</span>
      {article.topics[0] && (
        <>
          <span>·</span>
          <span className="text-accent">#{article.topics[0]}</span>
        </>
      )}
      <span className="ml-auto" />
      <BiasBar sources={article.cluster_source_names} compact />
      <ClusterBadge clusterId={article.cluster_id} sources={article.cluster_sources} />
      <CardActions articleId={article.id} saved={article.saved} />
    </div>
  )
}

// Historia destacada (lead): titular grande + imagen mediana + entradilla.
export function LeadCard({
  article,
  onDiscard,
}: {
  article: Article
  onDiscard?: (id: number) => void
}) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noreferrer"
      className="group relative mb-4 block animate-fade-in overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-accent/40"
    >
      <DiscardButton id={article.id} onDiscard={onDiscard} />
      <div className="flex flex-col sm:flex-row">
        {article.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={article.image_url}
            alt=""
            className="h-44 w-full shrink-0 object-cover sm:h-auto sm:w-2/5"
            loading="lazy"
          />
        )}
        <div className="flex-1 p-5">
          <Meta article={article} />
          <h2 className="text-lg font-semibold leading-tight text-card-foreground transition-colors group-hover:text-accent sm:text-xl">
            {article.title}
          </h2>
          {article.summary && (
            <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{article.summary}</p>
          )}
        </div>
      </div>
    </a>
  )
}

// Titular compacto para la rejilla: miniatura pequeña + titular a 2 líneas.
export function HeadlineCard({
  article,
  onDiscard,
}: {
  article: Article
  onDiscard?: (id: number) => void
}) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noreferrer"
      className="group relative flex animate-fade-in gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:border-accent/40"
    >
      <DiscardButton id={article.id} onDiscard={onDiscard} />
      {article.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={article.image_url}
          alt=""
          className="h-14 w-14 shrink-0 rounded-lg object-cover"
          loading="lazy"
        />
      )}
      <div className="min-w-0 flex-1">
        <Meta article={article} />
        <h3 className="line-clamp-2 text-sm font-medium leading-snug text-card-foreground transition-colors group-hover:text-accent">
          {article.title}
        </h3>
      </div>
    </a>
  )
}

// Fila densa para la vista "Titulares" (text-first, sin imagen).
export function TitularRow({
  article,
  onDiscard,
}: {
  article: Article
  onDiscard?: (id: number) => void
}) {
  const { lang } = useI18n()
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noreferrer"
      className="group relative -mx-2 flex items-baseline gap-2 rounded px-2 py-2 transition-colors hover:bg-muted/40"
    >
      <span className="mt-0.5 select-none text-accent">›</span>
      <div className="min-w-0 flex-1">
        <span className="text-sm font-medium text-card-foreground transition-colors group-hover:text-accent">
          {article.title}
        </span>
        <span className="ml-2 whitespace-nowrap text-xs text-muted-foreground">
          {article.source_name ?? ''} · {relativeTime(article.published_at, lang)}
          {article.topics[0] ? ` · #${article.topics[0]}` : ''}
        </span>
      </div>
      <ClusterBadge clusterId={article.cluster_id} sources={article.cluster_sources} />
      <DiscardButton id={article.id} onDiscard={onDiscard} />
    </a>
  )
}

type Trend = {
  id: number
  size: number
  source_count: number
  top_title: string | null
  top_url: string | null
  label: string
}

// Lateral "Lo más visto": historias cubiertas por más fuentes (tendencias).
export function TrendsRail() {
  const { t } = useI18n()
  const [trends, setTrends] = useState<Trend[]>([])

  useEffect(() => {
    fetch('/api/trends')
      .then((r) => r.json())
      .then((d: { trends: Trend[] }) => setTrends(d.trends))
      .catch(() => {})
  }, [])

  if (trends.length === 0) return null

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Flame className="h-4 w-4 text-accent" />
        {t('feed.mostViewed')}
      </h3>
      <ol className="flex flex-col gap-3">
        {trends.slice(0, 7).map((tr, i) => (
          <a
            key={tr.id}
            href={tr.top_url || '#'}
            target="_blank"
            rel="noreferrer"
            className="group flex gap-3"
          >
            <span className="w-4 shrink-0 text-base font-bold text-accent">{i + 1}</span>
            <div className="min-w-0">
              <p className="line-clamp-2 text-sm leading-snug transition-colors group-hover:text-accent">
                {tr.top_title ?? tr.label}
              </p>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                {tr.source_count >= 2
                  ? `${tr.source_count} ${t('trends.sources')}`
                  : `${tr.size} ${t('trends.articles')}`}
                <ExternalLink className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
              </p>
            </div>
          </a>
        ))}
      </ol>
    </div>
  )
}
