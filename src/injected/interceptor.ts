import type { HttpMethod, InterceptorMessage } from '../shared/types'

const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

const postToContentScript = (message: InterceptorMessage): void => {
  window.postMessage(message, '*')
}

const parseHeaders = (headers: Headers | null): Record<string, string> => {
  const result: Record<string, string> = {}
  if (headers) {
    headers.forEach((value, key) => {
      result[key] = value
    })
  }
  return result
}

const getBodyString = (body: BodyInit | null | undefined): string | null => {
  if (!body) return null
  if (typeof body === 'string') return body
  if (body instanceof FormData) {
    const entries: string[] = []
    body.forEach((value, key) => {
      entries.push(`${key}: ${value}`)
    })
    return entries.join('\n')
  }
  if (body instanceof URLSearchParams) return body.toString()
  if (body instanceof Blob) return '[Blob]'
  if (body instanceof ArrayBuffer) return '[ArrayBuffer]'
  return String(body)
}

// ============ Fetch Interceptor ============
const originalFetch = window.fetch.bind(window)

window.fetch = async function (
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const id = generateId()
  const startTime = Date.now()

  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const method = (init?.method?.toUpperCase() || 'GET') as HttpMethod

  let requestHeaders: Record<string, string> = {}
  if (init?.headers) {
    if (init.headers instanceof Headers) {
      requestHeaders = parseHeaders(init.headers)
    } else if (Array.isArray(init.headers)) {
      init.headers.forEach(([key, value]) => {
        requestHeaders[key] = value
      })
    } else {
      requestHeaders = { ...init.headers } as Record<string, string>
    }
  }

  postToContentScript({
    source: 'netview-interceptor',
    type: 'request-start',
    payload: {
      id,
      timestamp: startTime,
      method,
      url,
      requestHeaders,
      requestBody: getBodyString(init?.body),
      type: 'fetch',
      state: 'pending',
    },
  })

  try {
    const response = await originalFetch(input, init)
    const clone = response.clone()
    const duration = Date.now() - startTime

    let responseBody: string | null = null
    try {
      responseBody = await clone.text()
    } catch {
      responseBody = '[Unable to read response body]'
    }

    postToContentScript({
      source: 'netview-interceptor',
      type: 'request-complete',
      payload: {
        id,
        status: response.status,
        statusText: response.statusText,
        responseHeaders: parseHeaders(response.headers),
        responseBody,
        duration,
        state: 'completed',
      },
    })

    return response
  } catch (error) {
    const duration = Date.now() - startTime

    postToContentScript({
      source: 'netview-interceptor',
      type: 'request-error',
      payload: {
        id,
        duration,
        state: 'error',
        error: error instanceof Error ? error.message : String(error),
      },
    })

    throw error
  }
}

// ============ XHR Interceptor ============
const originalXHROpen = XMLHttpRequest.prototype.open
const originalXHRSend = XMLHttpRequest.prototype.send
const originalXHRSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader

interface XHRWithNetView extends XMLHttpRequest {
  _netview?: {
    id: string
    method: HttpMethod
    url: string
    startTime: number
    requestHeaders: Record<string, string>
    requestBody: string | null
  }
}

XMLHttpRequest.prototype.open = function (
  this: XHRWithNetView,
  method: string,
  url: string | URL,
  async: boolean = true,
  username?: string | null,
  password?: string | null
): void {
  this._netview = {
    id: generateId(),
    method: method.toUpperCase() as HttpMethod,
    url: typeof url === 'string' ? url : url.href,
    startTime: 0,
    requestHeaders: {},
    requestBody: null,
  }

  return originalXHROpen.call(this, method, url, async, username, password)
}

XMLHttpRequest.prototype.setRequestHeader = function (
  this: XHRWithNetView,
  name: string,
  value: string
): void {
  if (this._netview) {
    this._netview.requestHeaders[name] = value
  }
  return originalXHRSetRequestHeader.call(this, name, value)
}

XMLHttpRequest.prototype.send = function (
  this: XHRWithNetView,
  body?: Document | XMLHttpRequestBodyInit | null
): void {
  if (this._netview) {
    this._netview.startTime = Date.now()
    this._netview.requestBody = body ? String(body) : null

    postToContentScript({
      source: 'netview-interceptor',
      type: 'request-start',
      payload: {
        id: this._netview.id,
        timestamp: this._netview.startTime,
        method: this._netview.method,
        url: this._netview.url,
        requestHeaders: this._netview.requestHeaders,
        requestBody: this._netview.requestBody,
        type: 'xhr',
        state: 'pending',
      },
    })

    const netviewData = this._netview

    this.addEventListener('load', () => {
      const duration = Date.now() - netviewData.startTime
      const responseHeaders: Record<string, string> = {}

      const headersStr = this.getAllResponseHeaders()
      if (headersStr) {
        headersStr.split('\r\n').forEach((line) => {
          const parts = line.split(': ')
          if (parts.length === 2) {
            responseHeaders[parts[0]] = parts[1]
          }
        })
      }

      postToContentScript({
        source: 'netview-interceptor',
        type: 'request-complete',
        payload: {
          id: netviewData.id,
          status: this.status,
          statusText: this.statusText,
          responseHeaders,
          responseBody: this.responseText,
          duration,
          state: 'completed',
        },
      })
    })

    this.addEventListener('error', () => {
      const duration = Date.now() - netviewData.startTime
      postToContentScript({
        source: 'netview-interceptor',
        type: 'request-error',
        payload: {
          id: netviewData.id,
          duration,
          state: 'error',
          error: 'Network error',
        },
      })
    })

    this.addEventListener('timeout', () => {
      const duration = Date.now() - netviewData.startTime
      postToContentScript({
        source: 'netview-interceptor',
        type: 'request-error',
        payload: {
          id: netviewData.id,
          duration,
          state: 'error',
          error: 'Request timeout',
        },
      })
    })
  }

  return originalXHRSend.call(this, body)
}

console.log('[NetView] Interceptor loaded')
