-- Búsqueda GNews escalable: caché compartida, throttle por perfil y BYOK.

-- Clave propia del usuario (BYOK), cifrada en reposo (ver lib/crypto.ts).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gnews_key TEXT;

-- Caché de consultas: evita repetir la llamada externa para la misma query.
-- Los artículos ya quedan en `articles`; esto solo recuerda qué se consultó.
CREATE TABLE IF NOT EXISTS search_cache (
  provider    TEXT NOT NULL,
  lang        TEXT NOT NULL,
  query_norm  TEXT NOT NULL,
  fetched_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, lang, query_norm)
);

-- Rate-limit de búsquedas por perfil (ventana móvil de 1 hora).
CREATE TABLE IF NOT EXISTS search_throttle (
  profile_id   UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  count        INT NOT NULL DEFAULT 0
);
