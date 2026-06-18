import { subscribe, type RealtimeEvent } from '@/lib/realtime'

export const dynamic = 'force-dynamic'

// GET /api/events — stream SSE de novedades en tiempo real.
export async function GET() {
  const encoder = new TextEncoder()
  let unsub = () => {}
  let heartbeat: ReturnType<typeof setInterval>

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: RealtimeEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
      }
      controller.enqueue(encoder.encode(`: connected\n\n`))
      unsub = subscribe(send)
      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`))
        } catch {
          /* cerrado */
        }
      }, 25000)
    },
    cancel() {
      unsub()
      clearInterval(heartbeat)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
