'use client'

import { Bookmark, BookOpen, Loader2, Sparkles, Volume2, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useI18n } from '@/lib/i18n'

type Summary = { summary: string | null; bullets: string[]; lang?: 'es' | 'en' }

// Elige una voz instalada que case con el idioma (p. ej. en-US, en-GB → 'en').
function pickVoice(bcp: string): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis?.getVoices() ?? []
  if (voices.length === 0) return null
  const base = bcp.split('-')[0]
  return (
    voices.find((v) => v.lang === bcp) ??
    voices.find((v) => v.lang.toLowerCase().startsWith(base)) ??
    null
  )
}

// Acciones por tarjeta: resumir (IA bajo demanda) · leer aquí (reader view) · guardar.
export function CardActions({
  articleId,
  title,
  saved,
}: {
  articleId: number
  title?: string
  saved?: boolean
}) {
  const router = useRouter()
  const { t, lang } = useI18n()
  const [isSaved, setIsSaved] = useState(Boolean(saved))
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<Summary | null>(null)
  const [speaking, setSpeaking] = useState(false)

  const read = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    router.push(`/read/${articleId}`)
  }
  const toggleSave = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const next = !isSaved
    setIsSaved(next)
    await fetch('/api/saved', {
      method: next ? 'POST' : 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ articleId }),
    }).catch(() => setIsSaved(!next))
  }

  const summarize = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setOpen(true)
    if (data) return
    setLoading(true)
    try {
      const r = await fetch(`/api/article/summary?id=${articleId}`)
      const d = (await r.json()) as Summary
      setData(d)
    } catch {
      setData({ summary: null, bullets: [] })
    } finally {
      setLoading(false)
    }
  }

  const close = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    window.speechSynthesis?.cancel()
    setSpeaking(false)
    setOpen(false)
  }

  const speak = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (speaking) {
      window.speechSynthesis.cancel()
      setSpeaking(false)
      return
    }
    const text = [data?.summary, ...(data?.bullets ?? [])].filter(Boolean).join('. ')
    if (!text) return
    // El idioma de la VOZ debe ser el del resumen (= idioma del artículo), no el de
    // la interfaz: un resumen en inglés con voz española suena fatal.
    const spoken = data?.lang ?? lang
    const bcp = spoken === 'en' ? 'en-US' : 'es-ES'
    const u = new SpeechSynthesisUtterance(text)
    u.lang = bcp
    const v = pickVoice(bcp)
    if (v) u.voice = v
    u.onend = () => setSpeaking(false)
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(u)
    setSpeaking(true)
  }

  return (
    <span className="flex items-center gap-0.5">
      <button
        type="button"
        onClick={summarize}
        title={t('card.summarize')}
        aria-label={t('card.summarize')}
        className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-accent"
      >
        <Sparkles className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={read}
        title={t('reader.read')}
        aria-label={t('reader.read')}
        className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <BookOpen className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={toggleSave}
        title={t('card.save')}
        aria-label={t('card.save')}
        className={
          'flex h-6 w-6 items-center justify-center rounded-full transition-colors hover:bg-muted ' +
          (isSaved ? 'text-accent' : 'text-muted-foreground hover:text-foreground')
        }
      >
        <Bookmark className="h-3.5 w-3.5" fill={isSaved ? 'currentColor' : 'none'} />
      </button>

      {open && (
        // biome-ignore lint/a11y/useKeyWithClickEvents: overlay de cierre
        <div
          onClick={close}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl border border-border bg-card p-5 shadow-2xl"
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-accent">
                <Sparkles className="h-4 w-4" />
                {t('card.summarize')}
              </div>
              <div className="flex items-center gap-1">
                {data?.summary && (
                  <button
                    type="button"
                    onClick={speak}
                    title={t('story.listen')}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Volume2 className={'h-4 w-4 ' + (speaking ? 'text-accent' : '')} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={close}
                  aria-label="Cerrar"
                  className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            {title && <p className="mb-3 text-sm font-medium leading-snug text-foreground">{title}</p>}
            {loading ? (
              <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('card.summarizing')}
              </div>
            ) : data?.summary ? (
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
              <p className="py-4 text-sm text-muted-foreground">{t('card.summaryFailed')}</p>
            )}
          </div>
        </div>
      )}
    </span>
  )
}
