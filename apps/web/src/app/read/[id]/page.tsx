'use client'

import { ArrowLeft, ExternalLink, Pause, Volume2 } from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n'

type Block = { tag: 'p' | 'h'; text: string }
type Data = {
  title: string
  url: string
  source: string | null
  image: string | null
  byline?: string
  blocks: Block[]
  extracted: boolean
}

export default function ReadPage() {
  const { id } = useParams<{ id: string }>()
  const { t } = useI18n()
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [speaking, setSpeaking] = useState(false)

  useEffect(() => {
    fetch(`/api/reader?id=${id}`)
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
    const text = data.blocks.map((b) => b.text).join('. ')
    if (!text) return
    const u = new SpeechSynthesisUtterance(text.slice(0, 8000))
    u.lang = 'es-ES'
    u.onend = () => setSpeaking(false)
    window.speechSynthesis.speak(u)
    setSpeaking(true)
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between gap-3">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          {t('story.back')}
        </Link>
        {data && (
          <div className="flex items-center gap-2">
            {data.blocks.length > 0 && (
              <Button variant="outline" size="sm" onClick={toggleSpeak}>
                {speaking ? <Pause className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </Button>
            )}
            <a href={data.url} target="_blank" rel="noreferrer">
              <Button variant="outline" size="sm">
                <ExternalLink className="h-4 w-4" />
                {t('reader.original')}
              </Button>
            </a>
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">…</p>
      ) : !data ? (
        <p className="text-sm text-muted-foreground">404</p>
      ) : (
        <article>
          {data.source && (
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-accent">{data.source}</p>
          )}
          <h1 className="mb-3 text-2xl font-semibold leading-tight tracking-tight">{data.title}</h1>
          {data.byline && <p className="mb-4 text-sm text-muted-foreground">{data.byline}</p>}
          {data.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.image} alt="" className="mb-6 w-full rounded-2xl object-cover" />
          )}
          {data.extracted ? (
            <div className="flex flex-col gap-4 leading-relaxed text-card-foreground">
              {data.blocks.map((b, i) =>
                b.tag === 'h' ? (
                  <h2 key={i} className="mt-2 text-lg font-semibold">
                    {b.text}
                  </h2>
                ) : (
                  <p key={i}>{b.text}</p>
                ),
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center">
              <p className="mb-4 text-sm text-muted-foreground">{t('reader.failed')}</p>
              <a href={data.url} target="_blank" rel="noreferrer">
                <Button>
                  <ExternalLink className="h-4 w-4" />
                  {t('reader.original')}
                </Button>
              </a>
            </div>
          )}
        </article>
      )}
    </div>
  )
}
