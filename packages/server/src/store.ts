import type { ServerFetchLog, SessionBuffer, NetViewOptions } from './types'

const DEFAULT_MAX_LOGS = 100
const DEFAULT_TTL_SECONDS = 60

class SessionStore {
  private sessions = new Map<string, SessionBuffer>()
  private maxLogsPerSession: number
  private ttlMs: number
  private cleanupInterval: ReturnType<typeof setInterval> | null = null

  constructor(options: NetViewOptions = {}) {
    this.maxLogsPerSession = options.maxLogsPerSession ?? DEFAULT_MAX_LOGS
    this.ttlMs = (options.ttlSeconds ?? DEFAULT_TTL_SECONDS) * 1000
    this.startCleanup()
  }

  private startCleanup(): void {
    // 30초마다 만료된 세션 정리
    this.cleanupInterval = setInterval(() => {
      const now = Date.now()
      for (const [sessionId, buffer] of this.sessions) {
        if (now - buffer.lastAccess > this.ttlMs) {
          this.sessions.delete(sessionId)
        }
      }
    }, 30000)
  }

  private getOrCreateSession(sessionId: string): SessionBuffer {
    let buffer = this.sessions.get(sessionId)
    if (!buffer) {
      buffer = {
        logs: [],
        lastAccess: Date.now(),
        subscribers: new Set(),
      }
      this.sessions.set(sessionId, buffer)
    }
    buffer.lastAccess = Date.now()
    return buffer
  }

  addLog(sessionId: string, log: ServerFetchLog): void {
    const buffer = this.getOrCreateSession(sessionId)

    // 최대 개수 초과 시 오래된 것 삭제
    if (buffer.logs.length >= this.maxLogsPerSession) {
      buffer.logs.shift()
    }

    buffer.logs.push(log)

    // 구독자에게 즉시 전달
    for (const subscriber of buffer.subscribers) {
      subscriber(log)
    }
  }

  subscribe(
    sessionId: string,
    callback: (log: ServerFetchLog) => void
  ): () => void {
    const buffer = this.getOrCreateSession(sessionId)
    buffer.subscribers.add(callback)

    // 버퍼에 있는 기존 로그 먼저 전달
    for (const log of buffer.logs) {
      callback(log)
    }

    // unsubscribe 함수 반환
    return () => {
      buffer.subscribers.delete(callback)
    }
  }

  getBufferedLogs(sessionId: string): ServerFetchLog[] {
    return this.sessions.get(sessionId)?.logs ?? []
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
    this.sessions.clear()
  }
}

// 싱글톤 인스턴스
let storeInstance: SessionStore | null = null

export function getStore(): SessionStore {
  if (!storeInstance) {
    throw new Error('NetView store not initialized. Call registerNetView() first.')
  }
  return storeInstance
}

export function initStore(options: NetViewOptions): SessionStore {
  if (storeInstance) {
    storeInstance.destroy()
  }
  storeInstance = new SessionStore(options)
  return storeInstance
}
