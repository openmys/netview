export interface NetViewOptions {
  /** 세션당 최대 로그 개수 (기본값: 100) */
  maxLogsPerSession?: number
  /** 로그 TTL 초 단위 (기본값: 60) */
  ttlSeconds?: number
  /** 디버그 모드 (기본값: false) */
  debug?: boolean
}

export interface ServerFetchLog {
  id: string
  sessionId: string
  timestamp: number
  method: string
  url: string
  requestHeaders: Record<string, string>
  requestBody: string | null
  status: number
  statusText: string
  responseHeaders: Record<string, string>
  responseBody: string | null
  duration: number
  error?: string
}

export interface SessionBuffer {
  logs: ServerFetchLog[]
  lastAccess: number
  subscribers: Set<(log: ServerFetchLog) => void>
}
