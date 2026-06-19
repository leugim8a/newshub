-- La caché de búsqueda recuerda también QUÉ artículos resolvió cada query, para
-- que el filtro de relevancia se aplique solo a los resultados de esa consulta
-- (y no a todos los artículos recientes de la fuente de búsqueda).
ALTER TABLE search_cache ADD COLUMN IF NOT EXISTS article_ids BIGINT[] NOT NULL DEFAULT '{}';
