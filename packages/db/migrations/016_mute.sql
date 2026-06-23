-- Silenciar: ocultar del feed por keyword o por fuente.
CREATE TABLE IF NOT EXISTS mute_filters (
  id          BIGSERIAL PRIMARY KEY,
  profile_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('keyword', 'source')),
  value       TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mute_profile ON mute_filters (profile_id);
