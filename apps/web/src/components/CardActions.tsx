'use client'

import { Bookmark, BookOpen } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useI18n } from '@/lib/i18n'

// Acciones por tarjeta: leer aquí (reader view) · guardar.
export function CardActions({
  articleId,
  saved,
}: {
  articleId: number
  title?: string
  saved?: boolean
}) {
  const router = useRouter()
  const { t } = useI18n()
  const [isSaved, setIsSaved] = useState(Boolean(saved))

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

  return (
    <span className="flex items-center gap-0.5">
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
    </span>
  )
}
