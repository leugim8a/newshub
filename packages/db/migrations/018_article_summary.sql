-- Resumen IA bajo demanda por artículo individual (botón "Resumir").
ALTER TABLE articles ADD COLUMN IF NOT EXISTS ai_summary      TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS ai_bullets      JSONB;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS ai_summarized_at TIMESTAMPTZ;
