-- NewsHub v0.2 — perfiles anónimos, temas propios, clustering semántico (pgvector)

CREATE EXTENSION IF NOT EXISTS vector;

-- Perfil anónimo (uno por navegador, vía cookie)
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lang        TEXT NOT NULL DEFAULT 'es',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Clusters: historia agregada (base de tendencias)
CREATE TABLE IF NOT EXISTS clusters (
  id          BIGSERIAL PRIMARY KEY,
  label       TEXT NOT NULL,
  centroid    vector(384) NOT NULL,
  size        INT NOT NULL DEFAULT 1,
  source_count INT NOT NULL DEFAULT 1,
  lang        TEXT NOT NULL DEFAULT 'es',
  first_seen  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  score_trend REAL NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_clusters_last_seen ON clusters (last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_clusters_score ON clusters (score_trend DESC);
-- Índice ANN para búsqueda por coseno (centroide del cluster)
CREATE INDEX IF NOT EXISTS idx_clusters_centroid ON clusters
  USING hnsw (centroid vector_cosine_ops);

-- Artículos: embedding + cluster
ALTER TABLE articles ADD COLUMN IF NOT EXISTS embedding vector(384);
ALTER TABLE articles ADD COLUMN IF NOT EXISTS cluster_id BIGINT REFERENCES clusters(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_articles_cluster ON articles (cluster_id);

-- Temas: curados (globales) vs propios (de un perfil)
ALTER TABLE topics ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'curated'
  CHECK (kind IN ('curated', 'custom'));
ALTER TABLE topics ADD COLUMN IF NOT EXISTS owner_profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
-- El slug deja de ser único global: único por (owner, slug). Curados tienen owner NULL.
ALTER TABLE topics DROP CONSTRAINT IF EXISTS topics_slug_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_topics_owner_slug
  ON topics (COALESCE(owner_profile_id, '00000000-0000-0000-0000-000000000000'::uuid), slug);

-- Qué temas sigue cada perfil (sustituye al flag global topics.followed)
CREATE TABLE IF NOT EXISTS profile_topics (
  profile_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  topic_id    BIGINT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (profile_id, topic_id)
);

-- Suscripciones push ligadas al perfil
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE;

-- Notificaciones ligadas a perfil y cluster
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS cluster_id BIGINT REFERENCES clusters(id) ON DELETE SET NULL;

-- Control de rate-limit / dedupe de notificaciones
CREATE TABLE IF NOT EXISTS notification_throttle (
  profile_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  topic_id     BIGINT REFERENCES topics(id) ON DELETE CASCADE,
  cluster_id   BIGINT REFERENCES clusters(id) ON DELETE CASCADE,
  last_notified TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (profile_id, topic_id, cluster_id)
);

CREATE INDEX IF NOT EXISTS idx_throttle_recent ON notification_throttle (profile_id, last_notified DESC);
