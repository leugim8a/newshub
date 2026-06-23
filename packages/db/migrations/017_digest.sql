-- Email digest: correo opcional por perfil (anónimo) + opt-in.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email          TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS digest_optin   BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS digest_lang    TEXT NOT NULL DEFAULT 'es';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS digest_sent_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_profiles_digest ON profiles (digest_optin) WHERE digest_optin;
