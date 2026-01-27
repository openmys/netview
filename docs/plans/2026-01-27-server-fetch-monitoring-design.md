# Server Fetch Monitoring Design

Next.js 서버 컴포넌트에서 발생하는 API 요청을 익스텐션에서 확인할 수 있도록 하는 기능 설계.

## 배경

현재 NetView 익스텐션은 클라이언트 사이드의 `fetch`/`XHR`만 인터셉트함.
Next.js 서버 컴포넌트의 fetch는 서버(Node.js)에서 실행되므로 브라우저 익스텐션에서 직접 캡처 불가.

## 해결 방안

npm 패키지(`netview-server`)를 제공하여 서버에서 fetch를 인터셉트하고,
SSE를 통해 브라우저 익스텐션으로 실시간 전달.

## 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                    Next.js Server                            │
│                                                              │
│  ┌──────────────────┐    ┌─────────────────────────────┐   │
│  │ instrumentation  │    │ 메모리 버퍼 (세션별)          │   │
│  │ global.fetch     │───►│ - 최대 100개/세션            │   │
│  │ 인터셉트          │    │ - 60초 TTL                   │   │
│  └──────────────────┘    └──────────────┬──────────────┘   │
│                                         │                   │
│  ┌──────────────────┐                   │                   │
│  │ cookies()        │    ┌──────────────▼──────────────┐   │
│  │ 세션 ID 읽기      │───►│ /api/__netview/stream (SSE) │   │
│  └──────────────────┘    └──────────────┬──────────────┘   │
└─────────────────────────────────────────┼───────────────────┘
                                          │ SSE
┌─────────────────────────────────────────▼───────────────────┐
│                    Chrome Extension                          │
│                                                              │
│  ┌──────────────────┐    ┌─────────────────────────────┐   │
│  │ 쿠키 설정         │    │ SSE 연결                     │   │
│  │ __netview_session │    │ ${origin}/api/__netview/    │   │
│  │ = uuid           │    │ stream?session=xxx          │   │
│  └──────────────────┘    └─────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Panel UI                                             │   │
│  │ - 클라이언트 fetch: [CLIENT] 라벨                     │   │
│  │ - 서버 fetch: [SERVER] 라벨                          │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## 결정 사항

| 항목 | 결정 | 이유 |
|------|------|------|
| 전달 방식 | SSE | 실시간, 구현 단순 |
| 세션 구분 | 세션 ID 기반 (탭별 분리) | 정확한 분리 |
| 패키지 설정 | 수동 설정 | 투명함, 커스터마이징 쉬움 |
| 메모리 관리 | 버퍼 + TTL | 연결 전 로그 복구 가능 |
| 세션 ID 전달 | 쿠키 | 서버 컴포넌트에서 cookies() 접근 가능 |
| 패키지 구조 | 모노레포 | 타입 공유 쉬움 |
| UI 구분 | 라벨 (한 리스트) | 시간순 흐름 파악 용이 |

## 패키지 구조

### 모노레포 레이아웃

```
netview/
├── packages/
│   └── server/
│       ├── package.json
│       ├── tsconfig.json
│       ├── src/
│       │   ├── index.ts          # 메인 export
│       │   ├── interceptor.ts    # global.fetch 인터셉트
│       │   ├── store.ts          # 세션별 로그 버퍼 관리
│       │   ├── stream.ts         # SSE 핸들러
│       │   └── types.ts          # 타입 정의
│       └── README.md
├── src/                          # 익스텐션 (기존)
├── package.json
└── pnpm-workspace.yaml
```

### 사용자 설정 파일

**instrumentation.ts**
```typescript
import { registerNetView } from 'netview-server'

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    registerNetView({
      maxLogsPerSession: 100,
      ttlSeconds: 60,
    })
  }
}
```

**app/api/__netview/stream/route.ts**
```typescript
export { GET } from 'netview-server/stream'
```

## 데이터 타입

### NetworkRequest (확장)

```typescript
export type RequestSource = 'client' | 'server'

export interface NetworkRequest {
  id: string
  timestamp: number
  method: HttpMethod
  url: string

  requestHeaders: Record<string, string>
  requestBody: string | null

  status?: number
  statusText?: string
  responseHeaders?: Record<string, string>
  responseBody?: string | null

  duration?: number
  type: 'fetch' | 'xhr'
  source: RequestSource       // 'client' | 'server'
  state: RequestState
  error?: string
}
```

### ServerFetchLog (SSE 전송용)

```typescript
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
```

## 메모리 관리 정책

- 세션당 최대 100개 로그 유지
- 60초 TTL (마지막 접근 기준)
- 초과 시 오래된 것부터 삭제
- SSE 연결 시 버퍼 로그 먼저 전송 후 실시간 스트림

## UI 표시

```
┌─────────────────────────────────────────────────┐
│ [CLIENT] GET /api/users           200   45ms   │
│ [SERVER] GET https://api.ext.com  200  120ms   │
│ [CLIENT] POST /api/login          201   89ms   │
│ [SERVER] GET https://db.api/data  200   67ms   │
└─────────────────────────────────────────────────┘
```

- CLIENT: 파란색 배지
- SERVER: 보라색 배지

## 구현 순서

### Phase 1: 모노레포 구조 설정
- pnpm workspace 설정
- packages/server 디렉토리 생성
- 공유 타입 구조 정리

### Phase 2: npm 패키지 구현 (netview-server)
- store.ts: 세션별 로그 버퍼 (Map + TTL)
- interceptor.ts: global.fetch 인터셉트
- stream.ts: SSE 엔드포인트 핸들러
- index.ts: 메인 export

### Phase 3: 익스텐션 수정
- 타입 확장 (source 필드 추가)
- 세션 ID 쿠키 설정
- SSE 연결 및 서버 로그 수신
- RequestItem에 라벨 표시

### Phase 4: 테스트
- 로컬 Next.js 앱에서 패키지 테스트
- 익스텐션 연동 테스트

## 제약 사항

- 서버리스 환경(Amplify)에서는 인스턴스 간 로그 공유 안됨
- 사용자가 직접 instrumentation.ts 및 API route 추가 필요
- SSE 연결 전 발생한 로그는 버퍼 한도 내에서만 복구 가능
