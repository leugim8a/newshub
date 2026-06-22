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
    'feed.topicsFilter': 'Temas',
    'nav.trends': 'Tendencias',
    'nav.sources': 'Fuentes',
    'nav.settings': 'Ajustes',
    'sources.title': 'Fuentes',
    'sources.subtitle': 'Añade feeds RSS de los medios que quieras agregar',
    'sources.add': 'Añadir fuente',
    'sources.url': 'URL del feed RSS',
    'sources.name': 'Nombre (opcional)',
    'sources.empty': 'No hay fuentes. Pega la URL de un feed RSS para empezar.',
    'sources.invalid': 'No se pudo leer ese RSS',
    'sources.added': 'Fuente añadida',
    'sources.active': 'Activa',
    'sources.paused': 'Pausada',
    'feed.title': 'Tu portada',
    'feed.subtitle': 'Personalizada según los temas que sigues',
    'feed.empty': 'Aún no hay artículos. Ejecuta la ingesta o espera al próximo ciclo.',
    'feed.all': 'Todo',
    'feed.live': 'En directo',
    'feed.mostViewed': 'Tendencias',
    'view.portada': 'Portada',
    'view.cards': 'Tarjetas',
    'view.headlines': 'Titulares',
    'view.mosaic': 'Mosaico',
    'feed.sections': 'Secciones',
    'feed.general': 'Otras',
    'feed.hidden': 'Ocultas',
    'feed.moveUp': 'Subir',
    'feed.moveDown': 'Bajar',
    'feed.hideSection': 'Ocultar sección',
    'feed.showSection': 'Mostrar',
    'feed.discard': 'Descartar',
    'feed.discarded': 'Noticia descartada',
    'common.undo': 'Deshacer',
    'topics.title': 'Temas',
    'topics.follow': 'Seguir',
    'topics.following': 'Siguiendo',
    'topics.curated': 'Categorías',
    'topics.custom': 'Tus temas',
    'group.actualidad': 'Actualidad',
    'group.tech': 'Tecnología y Ciencia',
    'group.sociedad': 'Sociedad',
    'topics.create': 'Crear tema propio',
    'topics.name': 'Nombre del tema',
    'topics.keywords': 'Palabras clave (separadas por comas)',
    'topics.add': 'Añadir',
    'topics.delete': 'Borrar',
    'topics.edit': 'Editar',
    'topics.section': 'Sección',
    'topics.newSection': 'Nueva sección',
    'topics.sectionName': 'Nombre de la sección',
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
    'trends.config': 'Configurar',
    'trends.ours': 'Noticias (tus medios)',
    'trends.window': 'Ventana',
    'trends.min': 'Cobertura mínima',
    'trends.rail': 'Lateral en portada',
    'trends.extSources': 'Ámbitos externos',
    'trends.allTopics': 'Todos los temas',
    'source.wikipedia': 'Lo más visto (Wikipedia)',
    'source.mastodon': 'Redes sociales (Mastodon)',
    'source.arxiv': 'Investigación (arXiv)',
    'source.google': 'Búsquedas (Google)',
    'push.enable': 'Activar notificaciones',
    'push.enabled': 'Notificaciones activadas',
    'push.blocked': 'Notificaciones bloqueadas en el navegador',
    'push.unsupported': 'Tu navegador no soporta notificaciones push',
    'time.now': 'ahora',
    'time.minutes': 'min',
    'time.hours': 'h',
    'time.days': 'd',
    'lang.label': 'Idioma',
    'settings.presets': 'Perfiles',
    'settings.presetsDesc': 'Configura la app de golpe para un tipo de usuario. Luego retocas lo que quieras.',
    'settings.apply': 'Aplicar',
    'settings.applied': 'Perfil aplicado',
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
    'feed.topicsFilter': 'Topics',
    'nav.trends': 'Trends',
    'nav.sources': 'Sources',
    'nav.settings': 'Settings',
    'sources.title': 'Sources',
    'sources.subtitle': 'Add RSS feeds from the outlets you want to aggregate',
    'sources.add': 'Add source',
    'sources.url': 'RSS feed URL',
    'sources.name': 'Name (optional)',
    'sources.empty': 'No sources yet. Paste an RSS feed URL to start.',
    'sources.invalid': 'Could not read that RSS',
    'sources.added': 'Source added',
    'sources.active': 'Active',
    'sources.paused': 'Paused',
    'feed.title': 'Your feed',
    'feed.subtitle': 'Personalized to the topics you follow',
    'feed.empty': 'No articles yet. Run ingestion or wait for the next cycle.',
    'feed.all': 'All',
    'feed.live': 'Live',
    'feed.mostViewed': 'Trending',
    'view.portada': 'Front page',
    'view.cards': 'Cards',
    'view.headlines': 'Headlines',
    'view.mosaic': 'Mosaic',
    'feed.sections': 'Sections',
    'feed.general': 'Other',
    'feed.hidden': 'Hidden',
    'feed.moveUp': 'Move up',
    'feed.moveDown': 'Move down',
    'feed.hideSection': 'Hide section',
    'feed.showSection': 'Show',
    'feed.discard': 'Dismiss',
    'feed.discarded': 'Article dismissed',
    'common.undo': 'Undo',
    'topics.title': 'Topics',
    'topics.follow': 'Follow',
    'topics.following': 'Following',
    'topics.curated': 'Categories',
    'topics.custom': 'Your topics',
    'group.actualidad': 'Current affairs',
    'group.tech': 'Tech & Science',
    'group.sociedad': 'Society',
    'topics.create': 'Create your own topic',
    'topics.name': 'Topic name',
    'topics.keywords': 'Keywords (comma-separated)',
    'topics.add': 'Add',
    'topics.delete': 'Delete',
    'topics.edit': 'Edit',
    'topics.section': 'Section',
    'topics.newSection': 'New section',
    'topics.sectionName': 'Section name',
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
    'trends.config': 'Configure',
    'trends.ours': 'News (your sources)',
    'trends.window': 'Window',
    'trends.min': 'Min coverage',
    'trends.rail': 'Sidebar on front page',
    'trends.extSources': 'External areas',
    'trends.allTopics': 'All topics',
    'source.wikipedia': 'Most viewed (Wikipedia)',
    'source.mastodon': 'Social (Mastodon)',
    'source.arxiv': 'Research (arXiv)',
    'source.google': 'Searches (Google)',
    'push.enable': 'Enable notifications',
    'push.enabled': 'Notifications enabled',
    'push.blocked': 'Notifications blocked in the browser',
    'push.unsupported': 'Your browser does not support push notifications',
    'time.now': 'now',
    'time.minutes': 'm',
    'time.hours': 'h',
    'time.days': 'd',
    'lang.label': 'Language',
    'settings.presets': 'Profiles',
    'settings.presetsDesc': 'Set up the app for a type of user in one click. Tweak it afterwards.',
    'settings.apply': 'Apply',
    'settings.applied': 'Profile applied',
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
