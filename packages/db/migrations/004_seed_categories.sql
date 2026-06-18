-- Reemplaza las categorías antiguas por las 9 curadas del PRD v1.0.
-- Las suscripciones son por perfil (profile_topics); aún no hay perfiles, así que
-- borrar y resembrar los curados es seguro.

DELETE FROM topics WHERE kind = 'curated';

INSERT INTO topics (slug, label, kind, lang, keywords) VALUES
  ('ia', 'IA', 'curated', 'es', ARRAY[
    'inteligencia artificial','ia','ai','machine learning','openai','anthropic','llm',
    'chatgpt','gemini','deep learning','red neuronal','neural network','copilot']),
  ('tecnologia', 'Tecnología', 'curated', 'es', ARRAY[
    'tecnología','technology','tech','software','hardware','app','smartphone','iphone',
    'android','chip','semiconductor','startup','gadget','ciberseguridad','cybersecurity']),
  ('economia', 'Economía', 'curated', 'es', ARRAY[
    'economía','economy','inflación','inflation','bce','ecb','tipos de interés',
    'interest rates','bolsa','stock market','pib','gdp','mercados','markets','recesión']),
  ('politica', 'Política', 'curated', 'es', ARRAY[
    'política','politics','gobierno','government','elecciones','election','congreso',
    'parliament','senado','ley','president','presidente','ministro','partido']),
  ('internacional', 'Internacional', 'curated', 'es', ARRAY[
    'internacional','international','guerra','war','ucrania','ukraine','gaza','israel',
    'china','eeuu','estados unidos','ue','onu','rusia','russia','otan','nato']),
  ('deportes', 'Deportes', 'curated', 'es', ARRAY[
    'deportes','sports','fútbol','football','soccer','baloncesto','basketball','nba',
    'tenis','tennis','liga','champions','mundial','olympics','fórmula 1','motogp']),
  ('ciencia', 'Ciencia', 'curated', 'es', ARRAY[
    'ciencia','science','investigación','research','nasa','espacio','space','física',
    'physics','biología','biology','salud','health','medicina','genética']),
  ('clima', 'Clima', 'curated', 'es', ARRAY[
    'clima','climate','cambio climático','climate change','emisiones','emissions','co2',
    'calentamiento','warming','energía','renovables','renewable','sostenibilidad']),
  ('cultura', 'Cultura', 'curated', 'es', ARRAY[
    'cultura','culture','cine','film','movie','música','music','arte','art','libro',
    'book','festival','serie','series','teatro','videojuegos']);
