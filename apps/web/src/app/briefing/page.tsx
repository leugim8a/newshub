'use client'

import { ArrowLeft, Layers, Pause, Volume2 } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { BiasBar } from '@/components/BiasBar'
import { Button } from '@/components/ui/button'
import { relativeTime, useI18n } from '@/lib/i18n'

type Item = {
  cluster_id: number
  title: string
  url: string
  image_url: string | null
  published_at: string
  source_count: number
  source_names: (string | null)[]
  summary: string | null
  bullets: string[]
}

export default function BriefingPage() {
  const { t, lang } = useI18n()
  const [items, setItems] = useState<Item[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [speaking, setSpeaking] = useState(false)
  const uttRef = useRef<SpeechSynthesisUtterance | null>(null)

  useEffect(() => {
    fetch(`/api/briefing?lang=${lang}`)
      .then((r) => r.json())
      .then((d: { items: Item[] }) => setItems(d.items))
      .finally(() => setLoading(false))
    return () => window.speechSynthesis?.cancel()
  }, [lang])

  const toggleSpeak = () => {
    if (!items) return
    if (speaking) {
      window.speechSynthesis.cancel()
      setSpeaking(false)
      return
    }
    const text = items
      .map((it) => [it.title, it.summary].filter(Boolean).join('. '))
      .join('. … ')
    if (!text) return
    const u = new SpeechSynthesisUtterance(text.slice(0, 9000))
    u.lang = lang === 'en' ? 'en-US' : 'es-ES'
    u.onend = () => setSpeaking(false)
    uttRef.current = u
    window.speechSynthesis.speak(u)
    setSpeaking(true)
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('story.back')}
        </Link>
        {items && items.length > 0 && (
          <Button variant="outline" size="sm" onClick={toggleSpeak}>
            {speaking ? <Pause className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            {speaking ? t('story.stop') : t('briefing.listen')}
          </Button>
        )}
      </div>

      <h1 className="mb-1 text-2xl font-semibold leading-tight tracking-tight">
        {t('briefing.title')}
      </h1>
      <p className="mb-7 text-sm text-muted-foreground">{t('briefing.subtitle')}</p>

      {loading ? (
        <p className="text-sm text-muted-foreground">…</p>
      ) : !items || items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('briefing.empty')}</p>
      ) : (
        <ol className="flex flex-col gap-5">
          {items.map((it, i) => (
            <li
              key={it.cluster_id}
              className="rounded-2xl border border-border bg-card p-5"
            >
              <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                <span className="text-base font-bold text-accent">{i + 1}</span>
                <Layers className="h-3.5 w-3.5 text-accent" />
                <span>
                  {it.source_count} {t('trends.sources')}
                </span>
                <span>·</span>
                <span>{relativeTime(it.published_at, lang)}</span>
              </div>
              <Link href={`/story/${it.cluster_id}`}>
                <h2 className="mb-2 text-lg font-semibold leading-tight transition-colors hover:text-accent">
                  {it.title}
                </h2>
              </Link>
              {it.summary && (
                <p className="text-sm leading-relaxed text-card-foreground">{it.summary}</p>
              )}
              {it.bullets.length > 0 && (
                <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-sm text-muted-foreground">
                  {it.bullets.map((b, j) => (
                    <li key={j}>{b}</li>
                  ))}
                </ul>
              )}
              <div className="mt-3">
                <BiasBar sources={it.source_names} compact />
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
