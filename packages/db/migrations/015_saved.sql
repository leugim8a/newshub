-- Guardar / leer luego.
CREATE TABLE IF NOT EXISTS saved_articles (
  profile_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  article_id  BIGINT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, article_id)
);
CREATE INDEX IF NOT EXISTS idx_saved_profile ON saved_articles (profile_id, created_at DESC);
