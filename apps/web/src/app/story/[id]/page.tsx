'use client'

import { ArrowLeft, ExternalLink, Layers, Pause, Volume2 } from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { relativeTime, useI18n } from '@/lib/i18n'

type Article = {
  id: number
  title: string
  url: string
  summary: string | null
  image_url: string | null
  published_at: string
  source_name: string | null
}
type Data = {
  cluster: { id: number; label: string; size: number; source_count: number }
  summary: string | null
  bullets: string[]
  articles: Article[]
}

export default function StoryPage() {
  const { id } = useParams<{ id: string }>()
  const { t, lang } = useI18n()
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [speaking, setSpeaking] = useState(false)
  const uttRef = useRef<SpeechSynthesisUtterance | null>(null)

  useEffect(() => {
    fetch(`/api/cluster?id=${id}`)
      .then((r) => r.json())
      .then((d: Data) => setData(d))
      .finally(() => setLoading(false))
    return () => window.speechSynthesis?.cancel()
  }, [id])

  const toggleSpeak = () => {
    if (!data) return
    if (speaking) {
      window.speechSynthesis.cancel()
      setSpeaking(false)
      return
    }
    const text = [data.summary, ...data.bullets].filter(Boolean).join('. ')
    if (!text) return
    const u = new SpeechSynthesisUtterance(text)
    u.lang = lang === 'en' ? 'en-US' : 'es-ES'
    u.onend = () => setSpeaking(false)
    uttRef.current = u
    window.speechSynthesis.speak(u)
    setSpeaking(true)
  }

  const title = data?.articles[0]?.title ?? data?.cluster.label ?? ''

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('story.back')}
      </Link>

      {loading ? (
        <p className="text-sm text-muted-foreground">…</p>
      ) : !data ? (
        <p className="text-sm text-muted-foreground">404</p>
      ) : (
        <>
          <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Layers className="h-4 w-4 text-accent" />
            <span>
              {data.cluster.source_count} {t('trends.sources')} · {data.cluster.size}{' '}
              {t('trends.articles')}
            </span>
          </div>
          <h1 className="mb-4 text-2xl font-semibold leading-tight tracking-tight">{title}</h1>

          {/* Resumen IA */}
          <div className="mb-6 rounded-2xl border border-border bg-card p-5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-accent">
                {t('story.summary')}
              </h2>
              {(data.summary || data.bullets.length > 0) && (
                <Button variant="outline" size="sm" onClick={toggleSpeak}>
                  {speaking ? <Pause className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                  {speaking ? t('story.stop') : t('story.listen')}
                </Button>
              )}
            </div>
            {data.summary ? (
              <>
                <p className="text-sm leading-relaxed text-card-foreground">{data.summary}</p>
                {data.bullets.length > 0 && (
                  <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-sm text-muted-foreground">
                    {data.bullets.map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">{t('story.noSummary')}</p>
            )}
          </div>

          {/* Cobertura: todas las fuentes */}
          <h2 className="mb-3 border-b border-border pb-2 text-sm font-semibold uppercase tracking-wide text-accent">
            {t('story.coverage')} ({data.articles.length})
          </h2>
          <div className="flex flex-col gap-2">
            {data.articles.map((a) => (
              <a
                key={a.id}
                href={a.url}
                target="_blank"
                rel="noreferrer"
                className="group flex items-baseline gap-2 rounded-xl border border-border bg-card p-3 transition-colors hover:border-accent/40"
              >
                <div className="min-w-0 flex-1">
                  <div className="mb-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground/80">{a.source_name ?? ''}</span>
                    <span>·</span>
                    <span>{relativeTime(a.published_at, lang)}</span>
                  </div>
                  <p className="text-sm font-medium leading-snug transition-colors group-hover:text-accent">
                    {a.title}
                  </p>
                </div>
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" />
              </a>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
