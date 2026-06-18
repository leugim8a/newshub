'use client'

// Utilidades de Web Push en el cliente (service worker + suscripción VAPID).

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const arr = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export async function enablePush(topics: string[] = []): Promise<'enabled' | 'blocked' | 'unsupported'> {
  if (!pushSupported()) return 'unsupported'

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return 'blocked'

  const reg = await navigator.serviceWorker.register('/sw.js')
  await navigator.serviceWorker.ready

  const res = await fetch('/api/push/vapid')
  const { publicKey } = (await res.json()) as { publicKey: string | null }
  if (!publicKey) return 'unsupported'

  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  })

  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ subscription, topics }),
  })

  return 'enabled'
}

export async function pushStatus(): Promise<'enabled' | 'default' | 'blocked' | 'unsupported'> {
  if (!pushSupported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'blocked'
  if (Notification.permission === 'default') return 'default'
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  return sub ? 'enabled' : 'default'
}
