// Bus de eventos en memoria para SSE. Cada cliente conectado registra un
// callback; al ingerir un artículo nuevo se hace publish() a todos.
//
// NOTA: válido para un único proceso/instancia (MVP). Para escalar a varias
// réplicas, sustituir por Redis pub/sub o Postgres LISTEN/NOTIFY.

export type RealtimeEvent = {
  type: 'article' | 'notification'
  title: string
  body?: string
  url?: string
  topic?: string
  at: string
}

type Subscriber = (event: RealtimeEvent) => void

declare global {
  // eslint-disable-next-line no-var
  var __newshubSubscribers: Set<Subscriber> | undefined
}

const subscribers = global.__newshubSubscribers ?? new Set<Subscriber>()
global.__newshubSubscribers = subscribers

export function subscribe(fn: Subscriber): () => void {
  subscribers.add(fn)
  return () => subscribers.delete(fn)
}

export function publish(event: RealtimeEvent): void {
  for (const fn of subscribers) {
    try {
      fn(event)
    } catch {
      // ignorar suscriptores rotos
    }
  }
}
