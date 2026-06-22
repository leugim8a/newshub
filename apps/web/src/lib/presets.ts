// Perfiles por defecto: preconfiguran temas + fuentes + ajustes para un tipo de
// usuario. El usuario los aplica y luego retoca lo que quiera.

export type PresetTopic = { label: string; keywords: string[]; group?: string }
export type PresetSource = {
  kind: 'rss' | 'sitemap'
  name: string
  url: string
  lang: string
  config?: Record<string, unknown>
}
export type Preset = {
  id: string
  name: string
  description: string
  curated: string[] // slugs de categorías curadas a seguir
  topics: PresetTopic[] // temas propios a crear
  sources: PresetSource[] // fuentes RSS/sitemap a añadir (globales)
  prefs: Record<string, unknown>
}

export const PRESETS: Preset[] = [
  {
    id: 'general',
    name: 'Generalista',
    description: 'Actualidad amplia y equilibrada. Todas las categorías y medios generalistas.',
    curated: [
      'ia',
      'tecnologia',
      'economia',
      'politica',
      'internacional',
      'deportes',
      'ciencia',
      'clima',
      'cultura',
    ],
    topics: [],
    sources: [],
    prefs: {
      view: 'portada',
      sectioned: true,
      trendsRail: true,
      trendSources: { wikipedia: true, mastodon: true, google: true, arxiv: false },
    },
  },
  {
    id: 'tech',
    name: 'Tech & IA',
    description: 'Tecnología, IA, startups y gadgets. The Verge, Ars Technica, MIT TR, Hacker News.',
    curated: ['ia', 'tecnologia', 'ciencia'],
    topics: [
      {
        label: 'Startups',
        keywords: ['startup', 'funding', 'venture capital', 'ronda de financiación', 'seed', 'serie a'],
        group: 'tech',
      },
      {
        label: 'Gadgets',
        keywords: ['gadget', 'smartphone', 'iphone', 'android', 'wearable', 'review'],
        group: 'tech',
      },
    ],
    sources: [
      { kind: 'rss', name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index', lang: 'en' },
      { kind: 'rss', name: 'MIT Technology Review', url: 'https://www.technologyreview.com/feed/', lang: 'en' },
      { kind: 'rss', name: 'Hacker News', url: 'https://hnrss.org/frontpage', lang: 'en' },
    ],
    prefs: {
      view: 'portada',
      sectioned: true,
      trendsRail: true,
      trendSources: { arxiv: true, mastodon: true, google: true, wikipedia: false },
    },
  },
  {
    id: 'ai-research',
    name: 'Investigador IA (muy técnico)',
    description: 'Muy técnico: LLMs, agentes, RAG, difusión. arXiv y papers destacados. Vista densa.',
    curated: ['ia', 'tecnologia', 'ciencia', 'speech-to-speech'],
    topics: [
      {
        label: 'LLMs',
        keywords: ['llm', 'large language model', 'gpt', 'claude', 'gemini', 'transformer', 'fine-tuning', 'rlhf'],
        group: 'Investigación',
      },
      {
        label: 'Agentes IA',
        keywords: ['ai agent', 'agentic', 'tool use', 'autonomous agent', 'multi-agent', 'function calling'],
        group: 'Investigación',
      },
      {
        label: 'RAG',
        keywords: ['retrieval augmented', 'rag', 'vector database', 'embeddings', 'semantic search'],
        group: 'Investigación',
      },
      {
        label: 'Difusión',
        keywords: ['diffusion model', 'stable diffusion', 'text-to-image', 'image generation', 'flux'],
        group: 'Investigación',
      },
    ],
    sources: [
      {
        kind: 'rss',
        name: 'arXiv cs.AI',
        url: 'https://export.arxiv.org/api/query?search_query=cat:cs.AI&sortBy=submittedDate&sortOrder=descending&max_results=30',
        lang: 'en',
      },
      {
        kind: 'rss',
        name: 'arXiv cs.LG',
        url: 'https://export.arxiv.org/api/query?search_query=cat:cs.LG&sortBy=submittedDate&sortOrder=descending&max_results=30',
        lang: 'en',
      },
      { kind: 'rss', name: 'Hacker News', url: 'https://hnrss.org/frontpage', lang: 'en' },
      { kind: 'rss', name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index', lang: 'en' },
    ],
    prefs: {
      view: 'headlines',
      sectioned: true,
      trendsRail: true,
      trendSources: { arxiv: true, google: true, mastodon: true, wikipedia: false },
    },
  },
  {
    id: 'finance',
    name: 'Finanzas & Inversión',
    description: 'Economía, mercados, cripto y bancos centrales. Expansión, Investing, Cointelegraph.',
    curated: ['economia', 'internacional'],
    topics: [
      {
        label: 'Mercados',
        keywords: ['bolsa', 'stock market', 'nasdaq', 's&p 500', 'ibex', 'dow jones', 'wall street'],
        group: 'Finanzas',
      },
      {
        label: 'Cripto',
        keywords: ['bitcoin', 'ethereum', 'crypto', 'blockchain', 'cripto'],
        group: 'Finanzas',
      },
      {
        label: 'Bancos centrales',
        keywords: ['bce', 'ecb', 'fed', 'reserva federal', 'tipos de interés', 'interest rates', 'inflación'],
        group: 'Finanzas',
      },
      {
        label: 'Empresas',
        keywords: ['resultados', 'earnings', 'ipo', 'opa', 'beneficios', 'fusión'],
        group: 'Finanzas',
      },
    ],
    sources: [
      { kind: 'rss', name: 'Expansión', url: 'https://e00-expansion.uecdn.es/rss/portada.xml', lang: 'es' },
      { kind: 'rss', name: 'Investing.com', url: 'https://www.investing.com/rss/news.rss', lang: 'en' },
      { kind: 'rss', name: 'Cointelegraph', url: 'https://cointelegraph.com/rss', lang: 'en' },
    ],
    prefs: {
      view: 'cards',
      sectioned: true,
      trendsRail: true,
      trendSources: { google: true, wikipedia: true, mastodon: false, arxiv: false },
    },
  },
]

export function getPreset(id: string): Preset | undefined {
  return PRESETS.find((p) => p.id === id)
}
