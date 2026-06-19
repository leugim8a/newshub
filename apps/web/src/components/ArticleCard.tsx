'use client'

import { ExternalLink } from 'lucide-react'
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
}

export function ArticleCard({ article }: { article: Article }) {
  const { lang } = useI18n()
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noreferrer"
      className="group animate-fade-in flex gap-4 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-accent/40"
    >
      {article.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={article.image_url}
          alt=""
          className="h-20 w-24 shrink-0 rounded-xl object-cover sm:h-24 sm:w-32"
          loading="lazy"
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground/80">{article.source_name ?? 'Fuente'}</span>
          <span>·</span>
          <span>{relativeTime(article.published_at, lang)}</span>
          <span className="ml-auto inline-flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <ExternalLink className="h-3 w-3" />
          </span>
        </div>
        <h3 className="line-clamp-2 font-medium leading-snug text-card-foreground">{article.title}</h3>
        {article.summary && (
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{article.summary}</p>
        )}
        {article.topics.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {article.topics.map((t) => (
              <Badge key={t} className="border-accent/30 text-accent">
                #{t}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </a>
  )
}
