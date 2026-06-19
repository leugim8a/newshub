// Cifrado simétrico para secretos en reposo (claves BYOK).
// AES-256-GCM con clave derivada de APP_SECRET. Si no hay APP_SECRET (dev),
// se guarda en claro con prefijo para que decrypt lo sepa.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

const SECRET = process.env.APP_SECRET

function keyBuf(): Buffer {
  return createHash('sha256')
    .update(SECRET || 'dev-secret-change-me')
    .digest()
}

export function encryptSecret(plain: string): string {
  if (!SECRET) return `plain:${plain}`
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', keyBuf(), iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `gcm:${Buffer.concat([iv, tag, enc]).toString('base64')}`
}

export function decryptSecret(stored: string | null): string | null {
  if (!stored) return null
  if (stored.startsWith('plain:')) return stored.slice(6)
  if (stored.startsWith('gcm:')) {
    if (!SECRET) return null
    try {
      const buf = Buffer.from(stored.slice(4), 'base64')
      const iv = buf.subarray(0, 12)
      const tag = buf.subarray(12, 28)
      const enc = buf.subarray(28)
      const d = createDecipheriv('aes-256-gcm', keyBuf(), iv)
      d.setAuthTag(tag)
      return Buffer.concat([d.update(enc), d.final()]).toString('utf8')
    } catch {
      return null
    }
  }
  return stored
}
