import { cookies } from 'next/headers'
import { initStore } from './store'
import type { NetViewOptions, ServerFetchLog } from './types'

const COOKIE_NAME = '__netview_session'

let isRegistered = false

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

function headersToRecord(headers: Headers): Record<string, string> {
  const record: Record<string, string> = {}
  headers.forEach((value, key) => {
    record[key] = value
  })
  return record
}

async function getSessionId(): Promise<string | null> {
  try {
    const cookieStore = await cookies()
    return cookieStore.get(COOKIE_NAME)?.value ?? null
  } catch {
    // cookies()가 사용 불가능한 컨텍스트
    return null
  }
}

export function registerNetView(options: NetViewOptions = {}): void {
  if (isRegistered) {
    if (options.debug) {
      console.log('[NetView] Already registered, skipping')
    }
    return
  }

  const store = initStore(options)
  const originalFetch = globalThis.fetch

  globalThis.fetch = async function netviewFetch(
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    const sessionId = await getSessionId()

    // 세션 ID가 없으면 원본 fetch 실행
    if (!sessionId) {
      return originalFetch(input, init)
    }

    const startTime = Date.now()
    const id = generateId()

    // URL 추출
    const url = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url

    // 내부 NetView 요청은 인터셉트하지 않음
    if (url.includes('/__netview/')) {
      return originalFetch(input, init)
    }

    const method = init?.method ?? 'GET'

    // 요청 헤더 추출
    let requestHeaders: Record<string, string> = {}
    if (init?.headers) {
      if (init.headers instanceof Headers) {
        requestHeaders = headersToRecord(init.headers)
      } else if (Array.isArray(init.headers)) {
        for (const [key, value] of init.headers) {
          requestHeaders[key] = value
        }
      } else {
        requestHeaders = { ...init.headers } as Record<string, string>
      }
    }

    // 요청 바디 추출
    let requestBody: string | null = null
    if (init?.body) {
      if (typeof init.body === 'string') {
        requestBody = init.body
      } else if (init.body instanceof FormData) {
        requestBody = '[FormData]'
      } else if (init.body instanceof URLSearchParams) {
        requestBody = init.body.toString()
      } else {
        requestBody = '[Binary Data]'
      }
    }

    try {
      const response = await originalFetch(input, init)
      const duration = Date.now() - startTime

      // 응답 바디 읽기 (clone해서 원본 response는 유지)
      let responseBody: string | null = null
      try {
        const cloned = response.clone()
        responseBody = await cloned.text()
      } catch {
        responseBody = '[Unable to read body]'
      }

      const log: ServerFetchLog = {
        id,
        sessionId,
        timestamp: startTime,
        method,
        url,
        requestHeaders,
        requestBody,
        status: response.status,
        statusText: response.statusText,
        responseHeaders: headersToRecord(response.headers),
        responseBody,
        duration,
      }

      store.addLog(sessionId, log)

      if (options.debug) {
        console.log(`[NetView] ${method} ${url} -> ${response.status} (${duration}ms)`)
      }

      return response
    } catch (error) {
      const duration = Date.now() - startTime

      const log: ServerFetchLog = {
        id,
        sessionId,
        timestamp: startTime,
        method,
        url,
        requestHeaders,
        requestBody,
        status: 0,
        statusText: 'Error',
        responseHeaders: {},
        responseBody: null,
        duration,
        error: error instanceof Error ? error.message : String(error),
      }

      store.addLog(sessionId, log)

      if (options.debug) {
        console.log(`[NetView] ${method} ${url} -> ERROR (${duration}ms)`)
      }

      throw error
    }
  }

  isRegistered = true

  if (options.debug) {
    console.log('[NetView] Registered successfully')
  }
}
