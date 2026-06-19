-- Noticias descartadas por perfil (se ocultan de su feed).
CREATE TABLE IF NOT EXISTS discarded_articles (
  profile_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  article_id  BIGINT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, article_id)
);

CREATE INDEX IF NOT EXISTS idx_discarded_profile ON discarded_articles (profile_id);
