# Server Fetch Monitoring Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Next.js 서버 컴포넌트의 API 요청을 브라우저 익스텐션에서 실시간으로 확인할 수 있도록 npm 패키지와 익스텐션을 구현한다.

**Architecture:** npm 패키지(`netview-server`)가 Next.js 서버의 `global.fetch`를 인터셉트하여 세션별 메모리 버퍼에 저장하고, SSE 엔드포인트를 통해 브라우저 익스텐션으로 실시간 전달한다. 익스텐션은 쿠키로 세션 ID를 관리하고 SSE로 서버 로그를 수신하여 클라이언트 요청과 함께 표시한다.

**Tech Stack:** TypeScript, Next.js (instrumentation API, App Router), SSE (Server-Sent Events), pnpm workspace

---

## Phase 1: 모노레포 구조 설정

### Task 1.1: pnpm workspace 설정

**Files:**
- Create: `pnpm-workspace.yaml`
- Modify: `package.json`

**Step 1: pnpm-workspace.yaml 생성**

```yaml
packages:
  - 'packages/*'
```

**Step 2: 루트 package.json 수정**

`package.json`의 scripts에 workspace 명령 추가:

```json
{
  "name": "netview",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "build:server": "pnpm --filter netview-server build",
    "lint": "eslint .",
    "preview": "vite preview"
  }
}
```

**Step 3: 변경사항 확인**

Run: `pnpm install`
Expected: 정상 완료

**Step 4: Commit**

```bash
git add pnpm-workspace.yaml package.json
git commit -m "chore: setup pnpm workspace for monorepo"
```

---

### Task 1.2: packages/server 디렉토리 구조 생성

**Files:**
- Create: `packages/server/package.json`
- Create: `packages/server/tsconfig.json`
- Create: `packages/server/src/index.ts`

**Step 1: packages/server/package.json 생성**

```json
{
  "name": "netview-server",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./stream": {
      "types": "./dist/stream.d.ts",
      "import": "./dist/stream.js"
    }
  },
  "files": [
    "dist"
  ],
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "peerDependencies": {
    "next": ">=14.0.0"
  },
  "devDependencies": {
    "typescript": "~5.9.3",
    "next": "^15.0.0",
    "@types/node": "^24.10.1"
  }
}
```

**Step 2: packages/server/tsconfig.json 생성**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 3: packages/server/src/index.ts placeholder 생성**

```typescript
// netview-server entry point
export { registerNetView } from './interceptor'
export type { NetViewOptions, ServerFetchLog } from './types'
```

**Step 4: 디렉토리 구조 확인**

Run: `ls -la packages/server/`
Expected: package.json, tsconfig.json, src/ 디렉토리 존재

**Step 5: Commit**

```bash
git add packages/
git commit -m "chore: create netview-server package structure"
```

---

## Phase 2: npm 패키지 핵심 구현

### Task 2.1: 타입 정의 (types.ts)

**Files:**
- Create: `packages/server/src/types.ts`

**Step 1: types.ts 작성**

```typescript
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
```

**Step 2: Commit**

```bash
git add packages/server/src/types.ts
git commit -m "feat(server): add type definitions"
```

---

### Task 2.2: 세션 스토어 구현 (store.ts)

**Files:**
- Create: `packages/server/src/store.ts`

**Step 1: store.ts 작성**

```typescript
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
```

**Step 2: Commit**

```bash
git add packages/server/src/store.ts
git commit -m "feat(server): implement session store with TTL and buffer"
```

---

### Task 2.3: Fetch 인터셉터 구현 (interceptor.ts)

**Files:**
- Create: `packages/server/src/interceptor.ts`

**Step 1: interceptor.ts 작성**

```typescript
import { cookies } from 'next/headers'
import { initStore, getStore } from './store'
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
```

**Step 2: Commit**

```bash
git add packages/server/src/interceptor.ts
git commit -m "feat(server): implement global.fetch interceptor"
```

---

### Task 2.4: SSE 스트림 핸들러 구현 (stream.ts)

**Files:**
- Create: `packages/server/src/stream.ts`

**Step 1: stream.ts 작성**

```typescript
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
      } catch (error) {
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
```

**Step 2: Commit**

```bash
git add packages/server/src/stream.ts
git commit -m "feat(server): implement SSE stream handler"
```

---

### Task 2.5: 메인 export 정리 (index.ts)

**Files:**
- Modify: `packages/server/src/index.ts`

**Step 1: index.ts 수정**

```typescript
export { registerNetView } from './interceptor'
export { getStore, initStore } from './store'
export type { NetViewOptions, ServerFetchLog, SessionBuffer } from './types'
```

**Step 2: 패키지 빌드 확인**

Run: `cd packages/server && pnpm install && pnpm build`
Expected: dist/ 디렉토리에 .js, .d.ts 파일 생성

**Step 3: Commit**

```bash
git add packages/server/src/index.ts
git commit -m "feat(server): finalize package exports"
```

---

## Phase 3: 익스텐션 수정

### Task 3.1: 타입 확장 (source 필드 추가)

**Files:**
- Modify: `src/shared/types.ts`

**Step 1: types.ts 수정**

`NetworkRequest` 인터페이스에 `source` 필드 추가:

```typescript
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
```

**Step 2: Commit**

```bash
git add src/shared/types.ts
git commit -m "feat(extension): add source field to NetworkRequest type"
```

---

### Task 3.2: content script에 세션 관리 및 SSE 연결 추가

**Files:**
- Modify: `src/content/index.tsx`

**Step 1: 세션 ID 생성 및 쿠키 설정 함수 추가**

`content/index.tsx` 상단에 추가:

```typescript
const NETVIEW_SESSION_COOKIE = '__netview_session'

// 세션 ID 생성 및 쿠키 설정
const initSession = (): string => {
  // 기존 세션 ID 확인
  const existingMatch = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${NETVIEW_SESSION_COOKIE}=([^;]*)`)
  )
  if (existingMatch) {
    return existingMatch[1]
  }

  // 새 세션 ID 생성
  const sessionId = crypto.randomUUID()
  document.cookie = `${NETVIEW_SESSION_COOKIE}=${sessionId}; path=/; SameSite=Lax`
  return sessionId
}
```

**Step 2: SSE 연결 함수 추가**

```typescript
// SSE로 서버 fetch 로그 수신
const connectServerStream = (sessionId: string): void => {
  const url = `${location.origin}/api/__netview/stream?session=${sessionId}`

  const eventSource = new EventSource(url)

  eventSource.onmessage = (event) => {
    try {
      const log = JSON.parse(event.data)

      // 에러 메시지인 경우 무시
      if (log.error) {
        console.debug('[NetView] Server stream error:', log.error)
        return
      }

      // 서버 fetch 로그를 NetworkRequest로 변환
      const request: NetworkRequest = {
        id: `server-${log.id}`,
        timestamp: log.timestamp,
        method: log.method as HttpMethod,
        url: log.url,
        requestHeaders: log.requestHeaders,
        requestBody: log.requestBody,
        status: log.status,
        statusText: log.statusText,
        responseHeaders: log.responseHeaders,
        responseBody: log.responseBody,
        duration: log.duration,
        type: 'fetch',
        source: 'server',
        state: log.error ? 'error' : 'completed',
        error: log.error,
      }

      const currentRequests = store.get(requestsAtom)
      store.set(requestsAtom, [...currentRequests, request])
    } catch (e) {
      console.debug('[NetView] Failed to parse server log:', e)
    }
  }

  eventSource.onerror = () => {
    // 서버에 netview-server가 설치되지 않은 경우 조용히 연결 종료
    eventSource.close()
  }
}
```

**Step 3: init 함수에서 세션 초기화 및 SSE 연결**

`init` 함수 수정:

```typescript
// Initialize
const init = (): void => {
  // 세션 초기화
  const sessionId = initSession()

  injectInterceptor()
  window.addEventListener('message', handleMessage)

  if (document.body) {
    mountPanel()
    // SSE 연결 (패널 마운트 후)
    connectServerStream(sessionId)
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      mountPanel()
      connectServerStream(sessionId)
    })
  }
}
```

**Step 4: handleMessage에서 source 필드 추가**

`handleMessage` 함수 수정 - `newRequest` 생성 시 `source: 'client'` 추가:

```typescript
if (type === 'request-start') {
  const newRequest: NetworkRequest = {
    id: payload.id,
    timestamp: payload.timestamp!,
    method: payload.method!,
    url: payload.url!,
    requestHeaders: payload.requestHeaders || {},
    requestBody: payload.requestBody || null,
    type: payload.type!,
    source: 'client',  // 추가
    state: 'pending',
  }
  // ...
}
```

**Step 5: Commit**

```bash
git add src/content/index.tsx
git commit -m "feat(extension): add session management and SSE connection"
```

---

### Task 3.3: RequestItem에 source 라벨 표시

**Files:**
- Modify: `src/panel/components/RequestItem.tsx`

**Step 1: source 배지 색상 정의 추가**

`methodColors` 아래에 추가:

```typescript
const sourceColors: Record<string, string> = {
  client: '#3b82f6',  // 파란색
  server: '#8b5cf6',  // 보라색
}
```

**Step 2: 헤더에 source 배지 추가**

`headerStyle` 내부의 method 배지 바로 앞에 source 배지 추가:

```typescript
{/* Source badge */}
<span
  style={{
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '9px',
    fontWeight: 600,
    background: sourceColors[request.source] + '20',
    color: sourceColors[request.source],
    textTransform: 'uppercase',
    fontFamily: "'JetBrains Mono', monospace",
  }}
>
  {request.source}
</span>
```

**Step 3: 기존 type 표시 제거 (또는 유지)**

source와 type이 중복 표시될 수 있으므로, 기존 type 표시 부분을 source로 대체하거나, 둘 다 표시할지 결정. source 배지가 더 중요하므로 type 표시는 제거:

기존 코드 삭제:
```typescript
{/* Type indicator - 삭제 */}
<span
  style={{
    fontSize: '9px',
    color: '#52525b',
    textTransform: 'uppercase',
  }}
>
  {request.type}
</span>
```

**Step 4: Commit**

```bash
git add src/panel/components/RequestItem.tsx
git commit -m "feat(extension): add source badge to request items"
```

---

### Task 3.4: injected.ts에서 source 필드 추가

**Files:**
- Modify: `src/injected/interceptor.ts`

**Step 1: interceptor.ts 확인 및 수정**

클라이언트 인터셉터에서 보내는 메시지에도 `source: 'client'` 포함 여부 확인. `InterceptorMessage`의 `payload`에는 이미 `type` 필드가 있으므로, `handleMessage`에서 `source: 'client'`를 명시적으로 설정하면 됨 (Task 3.2에서 완료).

별도 수정 불필요 - Skip

**Step 2: Commit**

이 단계는 skip (수정 없음)

---

## Phase 4: 빌드 및 테스트

### Task 4.1: 패키지 빌드 확인

**Step 1: netview-server 빌드**

Run: `pnpm --filter netview-server build`
Expected: 성공, dist/ 폴더에 index.js, stream.js 및 .d.ts 파일 생성

**Step 2: 익스텐션 빌드**

Run: `pnpm build`
Expected: 성공, dist/ 폴더에 익스텐션 파일 생성

**Step 3: Commit (빌드 성공 시)**

```bash
git add -A
git commit -m "chore: verify builds for server package and extension"
```

---

### Task 4.2: README 작성

**Files:**
- Create: `packages/server/README.md`

**Step 1: README.md 작성**

```markdown
# netview-server

Next.js 서버 컴포넌트의 API 요청을 NetView 익스텐션에서 확인할 수 있게 해주는 패키지.

## 설치

```bash
npm install netview-server
# or
pnpm add netview-server
```

## 설정

### 1. instrumentation.ts 생성

프로젝트 루트에 `instrumentation.ts` 파일 생성:

```typescript
import { registerNetView } from 'netview-server'

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    registerNetView({
      maxLogsPerSession: 100,  // 세션당 최대 로그 수
      ttlSeconds: 60,          // 로그 유지 시간 (초)
      debug: false,            // 디버그 로그 출력
    })
  }
}
```

### 2. API Route 생성

`app/api/__netview/stream/route.ts` 파일 생성:

```typescript
export { GET } from 'netview-server/stream'
```

### 3. next.config.js 설정 (필요 시)

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    instrumentationHook: true,
  },
}

module.exports = nextConfig
```

## 동작 방식

1. `registerNetView()`가 `global.fetch`를 인터셉트
2. 서버 컴포넌트의 모든 fetch 요청을 세션별로 메모리에 저장
3. 브라우저의 NetView 익스텐션이 SSE로 실시간 수신
4. 익스텐션에서 클라이언트/서버 요청을 함께 표시

## 제약 사항

- Next.js 14 이상 필요
- 서버리스 환경에서는 인스턴스 간 로그 공유 안됨
- 프로덕션에서는 사용 권장하지 않음 (개발/스테이징용)
```

**Step 2: Commit**

```bash
git add packages/server/README.md
git commit -m "docs(server): add README with setup instructions"
```

---

## 전체 파일 목록

### 신규 생성
- `pnpm-workspace.yaml`
- `packages/server/package.json`
- `packages/server/tsconfig.json`
- `packages/server/src/index.ts`
- `packages/server/src/types.ts`
- `packages/server/src/store.ts`
- `packages/server/src/interceptor.ts`
- `packages/server/src/stream.ts`
- `packages/server/README.md`

### 수정
- `package.json` (workspace scripts 추가)
- `src/shared/types.ts` (source 타입 추가)
- `src/content/index.tsx` (세션 관리, SSE 연결)
- `src/panel/components/RequestItem.tsx` (source 배지)
