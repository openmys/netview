import { type NextRequest } from 'next/server'
import { getStore } from './store'
import type { ServerFetchLog } from './types'

export async function GET(request: NextRequest): Promise<Response> {
  const sessionId = request.nextUrl.searchParams.get('session')

  if (!sessionId) {
    return new Response('Missing session parameter', { status: 400 })
  }

  let unsubscribe: (() => void) | null = null

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()

      const send = (log: ServerFetchLog) => {
        const data = `data: ${JSON.stringify(log)}\n\n`
        controller.enqueue(encoder.encode(data))
      }

      // 연결 확인 메시지
      controller.enqueue(encoder.encode(`: connected\n\n`))

      try {
        const store = getStore()
        unsubscribe = store.subscribe(sessionId, send)
      } catch {
        // 스토어가 초기화되지 않은 경우
        const errorMsg = `data: ${JSON.stringify({ error: 'NetView not initialized' })}\n\n`
        controller.enqueue(encoder.encode(errorMsg))
        controller.close()
      }
    },
    cancel() {
      if (unsubscribe) {
        unsubscribe()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
