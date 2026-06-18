-- NewsHub — esquema inicial

-- Fuentes de noticias (conectores enchufables)
CREATE TABLE IF NOT EXISTS sources (
  id          BIGSERIAL PRIMARY KEY,
  kind        TEXT NOT NULL CHECK (kind IN ('rss', 'newsapi', 'scrape')),
  name        TEXT NOT NULL,
  url         TEXT NOT NULL,
  lang        TEXT NOT NULL DEFAULT 'es',
  config      JSONB NOT NULL DEFAULT '{}'::jsonb,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  last_fetch  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (kind, url)
);

-- Artículos normalizados y deduplicados
CREATE TABLE IF NOT EXISTS articles (
  id            BIGSERIAL PRIMARY KEY,
  source_id     BIGINT REFERENCES sources(id) ON DELETE SET NULL,
  url           TEXT NOT NULL,
  url_canonical TEXT NOT NULL,
  title         TEXT NOT NULL,
  title_hash    TEXT NOT NULL,
  summary       TEXT,
  image_url     TEXT,
  lang          TEXT NOT NULL DEFAULT 'es',
  published_at  TIMESTAMPTZ,
  ingested_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (url_canonical),
  UNIQUE (title_hash)
);

CREATE INDEX IF NOT EXISTS idx_articles_published ON articles (published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_ingested ON articles (ingested_at DESC);

-- Temas seguidos (por keywords)
CREATE TABLE IF NOT EXISTS topics (
  id          BIGSERIAL PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  label       TEXT NOT NULL,
  keywords    TEXT[] NOT NULL DEFAULT '{}',
  lang        TEXT NOT NULL DEFAULT 'es',
  followed    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Relación N:M artículo ↔ tema (match de ingesta)
CREATE TABLE IF NOT EXISTS article_topics (
  article_id  BIGINT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  topic_id    BIGINT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  score       REAL NOT NULL DEFAULT 1.0,
  PRIMARY KEY (article_id, topic_id)
);

CREATE INDEX IF NOT EXISTS idx_article_topics_topic ON article_topics (topic_id);

-- Suscripciones Web Push (endpoints de navegador)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          BIGSERIAL PRIMARY KEY,
  endpoint    TEXT NOT NULL UNIQUE,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  topic_slugs TEXT[] NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notificaciones generadas
CREATE TABLE IF NOT EXISTS notifications (
  id          BIGSERIAL PRIMARY KEY,
  article_id  BIGINT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  topic_id    BIGINT REFERENCES topics(id) ON DELETE SET NULL,
  title       TEXT NOT NULL,
  body        TEXT,
  delivered   BOOLEAN NOT NULL DEFAULT FALSE,
  read        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications (created_at DESC);
