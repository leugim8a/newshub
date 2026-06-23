-- Resumen IA por cluster (historia): se genera bajo demanda y se cachea.
ALTER TABLE clusters ADD COLUMN IF NOT EXISTS summary TEXT;
ALTER TABLE clusters ADD COLUMN IF NOT EXISTS bullets JSONB;
ALTER TABLE clusters ADD COLUMN IF NOT EXISTS summarized_at TIMESTAMPTZ;
