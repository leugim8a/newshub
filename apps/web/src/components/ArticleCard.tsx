'use client'

import { ExternalLink, X } from 'lucide-react'
import { BiasBar } from '@/components/BiasBar'
import { ClusterBadge } from '@/components/ClusterBadge'
import { Badge } from '@/components/ui/badge'
import { relativeTime, useI18n } from '@/lib/i18n'

export type Article = {
  id: number
  url: string
  title: string
  summary: string | null
  image_url: string | null
  lang: string
  published_at: string
  source_name: string | null
  topics: string[]
  cluster_id?: number | null
  cluster_size?: number | null
  cluster_sources?: number | null
  cluster_source_names?: (string | null)[] | null
}

export function ArticleCard({
  article,
  onDiscard,
}: {
  article: Article
  onDiscard?: (id: number) => void
}) {
  const { t, lang } = useI18n()
  const hasImage = Boolean(article.image_url)

  return (
    <a
      href={article.url}
      target="_blank"
      rel="noreferrer"
      className="group relative block animate-fade-in overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-accent/40"
    >
      {onDiscard && (
        <button
          type="button"
          title={t('feed.discard')}
          aria-label={t('feed.discard')}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onDiscard(article.id)
          }}
          className="absolute right-2 top-2 z-20 flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-black/45 text-white opacity-0 backdrop-blur-sm transition-opacity hover:bg-black/70 group-hover:opacity-100"
        >
          <X className="h-4 w-4" />
        </button>
      )}
      {hasImage && (
        <div className="relative h-44 w-full overflow-hidden sm:h-52">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={article.image_url as string}
            alt=""
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
          {/* Degradado para legibilidad de los chips y fundido con la tarjeta */}
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent" />
          {article.topics.length > 0 && (
            <div className="absolute bottom-2.5 left-3 flex flex-wrap gap-1.5">
              {article.topics.slice(0, 3).map((tp) => (
                <span
                  key={tp}
                  className="rounded-full border border-white/20 bg-black/50 px-2.5 py-0.5 text-xs font-medium text-white backdrop-blur-sm"
                >
                  #{tp}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="p-4">
        <div className="mb-1.5 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground/80">{article.source_name ?? 'Fuente'}</span>
          <span>·</span>
          <span>{relativeTime(article.published_at, lang)}</span>
          <span className="ml-auto" />
          <BiasBar sources={article.cluster_source_names} compact />
          <ClusterBadge clusterId={article.cluster_id} sources={article.cluster_sources} />
          <ExternalLink className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
        </div>
        <h3 className="line-clamp-2 font-medium leading-snug text-card-foreground transition-colors group-hover:text-accent">
          {article.title}
        </h3>
        {article.summary && (
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{article.summary}</p>
        )}
        {!hasImage && article.topics.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {article.topics.map((tp) => (
              <Badge key={tp} className="border-accent/30 text-accent">
                #{tp}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </a>
  )
}
