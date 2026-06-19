'use client'

// i18n ligero (es/en) sin dependencias. Detecta el idioma del navegador y
// lo persiste en localStorage.
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type Lang = 'es' | 'en'

const dict = {
  es: {
    'app.name': 'NewsHub',
    'app.tagline': 'Lo último, al instante',
    'nav.feed': 'Portada',
    'nav.topics': 'Temas',
    'nav.trends': 'Tendencias',
    'nav.settings': 'Ajustes',
    'feed.title': 'Tu portada',
    'feed.subtitle': 'Personalizada según los temas que sigues',
    'feed.empty': 'Aún no hay artículos. Ejecuta la ingesta o espera al próximo ciclo.',
    'feed.all': 'Todo',
    'feed.live': 'En directo',
    'feed.discard': 'Descartar',
    'feed.discarded': 'Noticia descartada',
    'common.undo': 'Deshacer',
    'topics.title': 'Temas',
    'topics.follow': 'Seguir',
    'topics.following': 'Siguiendo',
    'topics.curated': 'Categorías',
    'topics.custom': 'Tus temas',
    'topics.create': 'Crear tema propio',
    'topics.name': 'Nombre del tema',
    'topics.keywords': 'Palabras clave (separadas por comas)',
    'topics.add': 'Añadir',
    'topics.delete': 'Borrar',
    'topics.edit': 'Editar',
    'topics.search': 'Buscar contenidos',
    'topics.searching': 'Buscando…',
    'topics.searchResult': 'artículos en el tema',
    'topics.searchNoKey': 'Sin clave GNews: solo se enlazó lo ya descargado',
    'topics.customEmpty': 'Crea un tema con tus palabras clave para seguir algo muy concreto.',
    'trends.title': 'Tendencias',
    'trends.subtitle': 'Las historias que más crecen ahora mismo',
    'trends.empty': 'Aún no hay tendencias. Se forman cuando varias fuentes cubren la misma historia.',
    'trends.sources': 'fuentes',
    'trends.articles': 'artículos',
    'push.enable': 'Activar notificaciones',
    'push.enabled': 'Notificaciones activadas',
    'push.blocked': 'Notificaciones bloqueadas en el navegador',
    'push.unsupported': 'Tu navegador no soporta notificaciones push',
    'time.now': 'ahora',
    'time.minutes': 'min',
    'time.hours': 'h',
    'time.days': 'd',
    'lang.label': 'Idioma',
    'settings.gnews': 'Tu clave GNews (opcional)',
    'settings.gnewsDesc': 'Usa tu propia cuota de búsqueda. Se guarda cifrada y nunca se muestra.',
    'settings.gnewsPlaceholder': 'Pega tu API key de gnews.io',
    'settings.gnewsActive': 'Usando tu clave',
    'settings.getKey': '¿No tienes? Consíguela gratis en gnews.io',
    'settings.save': 'Guardar',
    'settings.clear': 'Quitar',
  },
  en: {
    'app.name': 'NewsHub',
    'app.tagline': 'The latest, instantly',
    'nav.feed': 'Feed',
    'nav.topics': 'Topics',
    'nav.trends': 'Trends',
    'nav.settings': 'Settings',
    'feed.title': 'Your feed',
    'feed.subtitle': 'Personalized to the topics you follow',
    'feed.empty': 'No articles yet. Run ingestion or wait for the next cycle.',
    'feed.all': 'All',
    'feed.live': 'Live',
    'feed.discard': 'Dismiss',
    'feed.discarded': 'Article dismissed',
    'common.undo': 'Undo',
    'topics.title': 'Topics',
    'topics.follow': 'Follow',
    'topics.following': 'Following',
    'topics.curated': 'Categories',
    'topics.custom': 'Your topics',
    'topics.create': 'Create your own topic',
    'topics.name': 'Topic name',
    'topics.keywords': 'Keywords (comma-separated)',
    'topics.add': 'Add',
    'topics.delete': 'Delete',
    'topics.edit': 'Edit',
    'topics.search': 'Search content',
    'topics.searching': 'Searching…',
    'topics.searchResult': 'articles in this topic',
    'topics.searchNoKey': 'No GNews key: only linked already-fetched articles',
    'topics.customEmpty': 'Create a topic with your own keywords to follow something specific.',
    'trends.title': 'Trends',
    'trends.subtitle': 'The stories growing fastest right now',
    'trends.empty': 'No trends yet. They form when several sources cover the same story.',
    'trends.sources': 'sources',
    'trends.articles': 'articles',
    'push.enable': 'Enable notifications',
    'push.enabled': 'Notifications enabled',
    'push.blocked': 'Notifications blocked in the browser',
    'push.unsupported': 'Your browser does not support push notifications',
    'time.now': 'now',
    'time.minutes': 'm',
    'time.hours': 'h',
    'time.days': 'd',
    'lang.label': 'Language',
    'settings.gnews': 'Your GNews key (optional)',
    'settings.gnewsDesc': 'Use your own search quota. Stored encrypted, never shown.',
    'settings.gnewsPlaceholder': 'Paste your gnews.io API key',
    'settings.gnewsActive': 'Using your key',
    'settings.getKey': "Don't have one? Get it free at gnews.io",
    'settings.save': 'Save',
    'settings.clear': 'Remove',
  },
} as const

type Key = keyof (typeof dict)['es']

const I18nContext = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (k: Key) => string }>({
  lang: 'es',
  setLang: () => {},
  t: (k) => k,
})

function detectLang(): Lang {
  if (typeof navigator === 'undefined') return 'es'
  return navigator.language.toLowerCase().startsWith('en') ? 'en' : 'es'
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('es')

  useEffect(() => {
    const saved = localStorage.getItem('newshub.lang') as Lang | null
    setLangState(saved ?? detectLang())
  }, [])

  const setLang = (l: Lang) => {
    setLangState(l)
    localStorage.setItem('newshub.lang', l)
    document.documentElement.lang = l
  }

  const t = (k: Key) => dict[lang][k] ?? k

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>
}

export const useI18n = () => useContext(I18nContext)

export function relativeTime(date: string | Date, lang: Lang): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const sec = Math.floor((Date.now() - d.getTime()) / 1000)
  const u = dict[lang]
  if (sec < 60) return u['time.now']
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} ${u['time.minutes']}`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} ${u['time.hours']}`
  return `${Math.floor(hr / 24)} ${u['time.days']}`
}
