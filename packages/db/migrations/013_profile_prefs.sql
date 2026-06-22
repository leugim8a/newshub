-- Preferencias de UI del perfil (vista, secciones, orden, ocultas) para que
-- viajen entre dispositivos en vez de vivir solo en localStorage.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS prefs JSONB NOT NULL DEFAULT '{}'::jsonb;
