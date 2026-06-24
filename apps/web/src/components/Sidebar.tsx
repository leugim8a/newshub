'use client'

import { Newspaper, Hash, Rss, Settings, Radio, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ThemeToggle } from '@/components/ThemeToggle'
import { cn } from '@/lib/utils/cn'

const tabs = [
  { id: 'feed', path: '/', icon: Newspaper, label: 'Portada' },
  { id: 'trends', path: '/trends', icon: TrendingUp, label: 'Tendencias' },
  { id: 'topics', path: '/topics', icon: Hash, label: 'Temas' },
  { id: 'sources', path: '/sources', icon: Rss, label: 'Fuentes' },
  { id: 'settings', path: '/settings', icon: Settings, label: 'Ajustes' },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <div className="fixed left-0 top-0 z-40 flex h-full w-20 flex-col items-center gap-6 border-r border-border bg-sidebar py-6">
      {/* Marca */}
      <Link href="/" className="brand-glow mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/15 text-accent">
        <Radio className="h-6 w-6" />
      </Link>

      <nav className="flex flex-col gap-3">
        {tabs.map((tab, index) => {
          const Icon = tab.icon
          const isActive = tab.path === '/' ? pathname === '/' : pathname.startsWith(tab.path)
          const accentOpacity = Math.max(0.08, 0.5 - index * 0.1)
          return (
            <Link
              key={tab.id}
              href={tab.path}
              title={tab.label}
              aria-label={tab.label}
              className={cn(
                'relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-full transition-all duration-200',
                isActive
                  ? 'border border-white/[0.08] bg-white/[0.07] text-foreground shadow-lg backdrop-blur-sm'
                  : 'text-muted-foreground hover:bg-muted/50',
              )}
            >
              {isActive && (
                <div
                  className="pointer-events-none absolute inset-0 rounded-full"
                  style={{
                    maskImage: 'linear-gradient(to bottom, black, transparent 60%)',
                    WebkitMaskImage: 'linear-gradient(to bottom, black, transparent 60%)',
                    border: `1px solid hsl(var(--accent) / ${accentOpacity})`,
                  }}
                />
              )}
              <Icon className="relative z-10 h-5 w-5" />
            </Link>
          )
        })}
      </nav>

      <div className="mt-auto">
        <ThemeToggle />
      </div>
    </div>
  )
}
