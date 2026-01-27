export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD'

export type RequestState = 'pending' | 'completed' | 'error'

export type RequestSource = 'client' | 'server'

export interface NetworkRequest {
  id: string
  timestamp: number
  method: HttpMethod
  url: string

  // Request
  requestHeaders: Record<string, string>
  requestBody: string | null

  // Response (filled after completion)
  status?: number
  statusText?: string
  responseHeaders?: Record<string, string>
  responseBody?: string | null

  // Meta
  duration?: number
  type: 'fetch' | 'xhr'
  source: RequestSource  // 'client' | 'server'
  state: RequestState
  error?: string
}

export interface InterceptorMessage {
  source: 'netview-interceptor'
  type: 'request-start' | 'request-complete' | 'request-error'
  payload: Partial<NetworkRequest> & { id: string }
}

export interface PanelState {
  isOpen: boolean
  isMinimized: boolean
  position: { x: number; y: number }
  size: { width: number; height: number }
}
