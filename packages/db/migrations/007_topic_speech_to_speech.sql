-- Categoría específica: modelos Speech-to-Speech (voz↔voz, modelos de voz en
-- tiempo real). Keywords centradas en el concepto y modelos concretos; se evita
-- el acrónimo "sts" por ambiguo (Ship-to-Ship).

INSERT INTO topics (slug, label, kind, lang, keywords) VALUES
  ('speech-to-speech', 'Speech-to-Speech', 'curated', 'es', ARRAY[
    'speech to speech','speech-to-speech','voice to voice','voice-to-voice',
    'spoken language model','audio language model','real-time voice ai','realtime voice',
    'conversational voice ai','modelo de voz','síntesis de voz',
    'moshi','voxtral','gemini live','gpt-4o realtime','realtime api','sesame csm',
    'ultravox','hume evi','kyutai','elevenlabs'])
ON CONFLICT DO NOTHING;

-- Auto-seguir la nueva categoría en los perfiles existentes (para que aparezca ya).
INSERT INTO profile_topics (profile_id, topic_id)
  SELECT p.id, t.id
  FROM profiles p
  CROSS JOIN topics t
  WHERE t.slug = 'speech-to-speech' AND t.kind = 'curated'
ON CONFLICT DO NOTHING;
