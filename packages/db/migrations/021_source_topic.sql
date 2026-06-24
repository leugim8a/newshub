-- Fuente ligada a un tema: sus artículos se etiquetan a ese tema directamente
-- (p. ej. el canal de YouTube de un divulgador → su tema), sin depender de keywords.
ALTER TABLE sources ADD COLUMN IF NOT EXISTS topic_id BIGINT REFERENCES topics(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_sources_topic ON sources (topic_id) WHERE topic_id IS NOT NULL;
