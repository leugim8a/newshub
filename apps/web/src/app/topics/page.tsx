'use client'

import { useEffect, useState } from 'react'
import ShinyText from '@/components/ShinyText'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useI18n } from '@/lib/i18n'

type Topic = { slug: string; label: string; followed: boolean; article_count: number }

export default function TopicsPage() {
  const { t } = useI18n()
  const [topics, setTopics] = useState<Topic[]>([])

  const load = () =>
    fetch('/api/topics')
      .then((r) => r.json())
      .then((d: { topics: Topic[] }) => setTopics(d.topics))

  useEffect(() => {
    load()
  }, [])

  const toggle = async (slug: string, followed: boolean) => {
    setTopics((ts) => ts.map((x) => (x.slug === slug ? { ...x, followed } : x)))
    await fetch('/api/topics', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug, followed }),
    })
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="mb-8 text-2xl font-semibold tracking-tight">
        <ShinyText text={t('topics.title')} />
      </h1>
      <div className="flex flex-col gap-3">
        {topics.map((tp) => (
          <div
            key={tp.slug}
            className="flex items-center justify-between rounded-2xl border border-border bg-card p-4"
          >
            <div>
              <p className="font-medium">#{tp.label}</p>
              <Badge className="mt-1">{tp.article_count} artículos</Badge>
            </div>
            <Button
              variant={tp.followed ? 'secondary' : 'default'}
              size="sm"
              onClick={() => toggle(tp.slug, !tp.followed)}
            >
              {tp.followed ? t('topics.following') : t('topics.follow')}
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
