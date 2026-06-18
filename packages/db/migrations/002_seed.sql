-- Semilla de fuentes RSS y temas de ejemplo (es/en). Idempotente.

INSERT INTO sources (kind, name, url, lang) VALUES
  ('rss', 'El País — Portada',        'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada', 'es'),
  ('rss', 'El Mundo — Portada',       'https://e00-elmundo.uecdn.es/elmundo/rss/portada.xml',             'es'),
  ('rss', 'Xataka',                   'https://www.xataka.com/index.xml',                                 'es'),
  ('rss', 'BBC News — World',         'http://feeds.bbci.co.uk/news/world/rss.xml',                       'en'),
  ('rss', 'The Guardian — World',     'https://www.theguardian.com/world/rss',                            'en'),
  ('rss', 'The Verge',               'https://www.theverge.com/rss/index.xml',                            'en')
ON CONFLICT (kind, url) DO NOTHING;

INSERT INTO topics (slug, label, keywords, lang) VALUES
  ('ia',          'Inteligencia Artificial', ARRAY['inteligencia artificial','ia','machine learning','openai','anthropic','llm','ai'], 'es'),
  ('economia',    'Economía',                ARRAY['economía','bce','inflación','tipos de interés','bolsa','pib'], 'es'),
  ('tech',        'Tecnología',              ARRAY['tech','technology','startup','chip','semiconductor','software'], 'en'),
  ('clima',       'Clima',                   ARRAY['clima','cambio climático','climate','emisiones','co2'], 'es')
ON CONFLICT (slug) DO NOTHING;
