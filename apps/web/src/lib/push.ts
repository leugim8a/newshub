// Helper de Web Push (VAPID) en el servidor.
import webpush from 'web-push'

let configured = false

function ensureConfigured() {
  if (configured) return
  const pub = process.env.VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@newshub.app'
  if (pub && priv) {
    webpush.setVapidDetails(subject, pub, priv)
    configured = true
  }
}

export function pushEnabled(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)
}

export type PushSub = {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

export async function sendPush(
  sub: PushSub,
  payload: { title: string; body?: string; url?: string },
): Promise<{ ok: boolean; gone?: boolean }> {
  if (!pushEnabled()) return { ok: false }
  ensureConfigured()
  try {
    await webpush.sendNotification(sub, JSON.stringify(payload))
    return { ok: true }
  } catch (err) {
    const code = (err as { statusCode?: number }).statusCode
    // 404/410 => endpoint caducado; el llamante debería borrarlo.
    return { ok: false, gone: code === 404 || code === 410 }
  }
}
