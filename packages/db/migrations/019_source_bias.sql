-- Objetividad editable por el usuario, por fuente: objetiva / mixta / sesgada.
-- NULL = sin clasificar (no cuenta en la barra). Es criterio del usuario, no impuesto.
ALTER TABLE sources ADD COLUMN IF NOT EXISTS objectivity TEXT
  CHECK (objectivity IN ('objective', 'mixed', 'biased'));
