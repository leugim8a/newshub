'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Level } from '@/lib/bias'

type OverrideMap = Record<string, Level>

type Ctx = {
  levelOf: (name: string | null | undefined) => Level | null
  overrides: OverrideMap
  setOverride: (name: string, level: Level | null) => void
}

const BiasContext = createContext<Ctx | null>(null)
const LS_KEY = 'newshub.objectivity'

export function BiasProvider({ children }: { children: ReactNode }) {
  const [overrides, setOverrides] = useState<OverrideMap>({})

  // Render instantáneo desde localStorage; refresco en segundo plano desde la API.
  useEffect(() => {
    try {
      const cached = localStorage.getItem(LS_KEY)
      if (cached) setOverrides(JSON.parse(cached))
    } catch {
      /* ignore */
    }
    fetch('/api/sources/objectivity')
      .then((r) => r.json())
      .then((d: { overrides: OverrideMap }) => {
        setOverrides(d.overrides || {})
        try {
          localStorage.setItem(LS_KEY, JSON.stringify(d.overrides || {}))
        } catch {
          /* ignore */
        }
      })
      .catch(() => {})
  }, [])

  const levelOf = (name: string | null | undefined): Level | null =>
    name ? (overrides[name] ?? null) : null

  const setOverride = (name: string, level: Level | null) => {
    setOverrides((prev) => {
      const next = { ...prev }
      if (level) next[name] = level
      else delete next[name]
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }

  return (
    <BiasContext.Provider value={{ levelOf, overrides, setOverride }}>{children}</BiasContext.Provider>
  )
}

export function useBias(): Ctx {
  const ctx = useContext(BiasContext)
  if (!ctx) return { levelOf: () => null, overrides: {}, setOverride: () => {} }
  return ctx
}
