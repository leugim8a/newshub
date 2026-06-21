-- Agrupar los temas en secciones (en vez de lista plana).
ALTER TABLE topics ADD COLUMN IF NOT EXISTS topic_group TEXT;

UPDATE topics SET topic_group = 'actualidad'
  WHERE kind = 'curated' AND slug IN ('politica', 'internacional', 'economia');
UPDATE topics SET topic_group = 'tech'
  WHERE kind = 'curated' AND slug IN ('ia', 'tecnologia', 'ciencia', 'speech-to-speech');
UPDATE topics SET topic_group = 'sociedad'
  WHERE kind = 'curated' AND slug IN ('deportes', 'cultura', 'clima');
-- Los temas propios (custom) quedan con topic_group NULL → sección "Tus temas".
