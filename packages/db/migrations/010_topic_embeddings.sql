-- Vector de cada tema (label + keywords) para matching semántico en la ingesta:
-- un artículo se asigna a un tema si TRATA de él, aunque no lleve la keyword exacta.
ALTER TABLE topics ADD COLUMN IF NOT EXISTS embedding vector(384);
