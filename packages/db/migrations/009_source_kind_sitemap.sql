-- Permitir fuentes de tipo 'sitemap' (newsletters/medios con archivo público sin RSS).
ALTER TABLE sources DROP CONSTRAINT IF EXISTS sources_kind_check;
ALTER TABLE sources ADD CONSTRAINT sources_kind_check
  CHECK (kind IN ('rss', 'newsapi', 'scrape', 'sitemap'));
