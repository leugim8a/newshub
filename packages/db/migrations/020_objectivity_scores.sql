-- Puntuaciones de objetividad por IA: una fila por (cluster, fuente). La IA compara
-- las coberturas de la MISMA noticia y puntúa 0-100 (100 = más objetiva) con motivo.
-- La media por fuente sugiere su objetividad; el rating manual del usuario prevalece.
CREATE TABLE IF NOT EXISTS objectivity_scores (
  cluster_id  BIGINT NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
  source_id   BIGINT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  score       INT NOT NULL CHECK (score BETWEEN 0 AND 100),
  reason      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (cluster_id, source_id)
);
CREATE INDEX IF NOT EXISTS idx_objscore_source ON objectivity_scores (source_id);

-- Marca para no re-puntuar el mismo cluster en cada pasada del cron.
ALTER TABLE clusters ADD COLUMN IF NOT EXISTS objectivity_scored_at TIMESTAMPTZ;
