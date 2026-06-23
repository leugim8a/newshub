'use client'

import { Layers } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n'

// Chip "N fuentes" → abre la historia (todas las coberturas + resumen).
export function ClusterBadge({
  clusterId,
  sources,
}: {
  clusterId?: number | null
  sources?: number | null
}) {
  const router = useRouter()
  const { t } = useI18n()
  if (!clusterId || !sources || sources < 2) return null
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        router.push(`/story/${clusterId}`)
      }}
      className="inline-flex items-center gap-1 rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent transition-colors hover:bg-accent/20"
    >
      <Layers className="h-3 w-3" />
      {sources} {t('trends.sources')}
    </button>
  )
}
