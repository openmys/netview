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
