import { createRoot } from 'react-dom/client'
import { Provider } from 'jotai'
import App from '../panel/App'
import type { InterceptorMessage, NetworkRequest, HttpMethod } from '../shared/types'
import { requestsAtom } from '../panel/stores/atoms'
import { createStore } from 'jotai'
import osCss from 'overlayscrollbars/overlayscrollbars.css?inline'

// Create Jotai store for external updates
const store = createStore()

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

// SSE로 서버 fetch 로그 수신
const connectServerStream = (sessionId: string): void => {
  const url = `${location.origin}/api/netview/stream?session=${sessionId}`

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

// Inject the interceptor script into page context
const injectInterceptor = (): void => {
  const script = document.createElement('script')
  script.src = chrome.runtime.getURL('injected.js')
  script.onload = () => script.remove()
  ;(document.head || document.documentElement).appendChild(script)
}

// Listen for messages from interceptor
const handleMessage = (event: MessageEvent<InterceptorMessage>): void => {
  if (event.source !== window) return
  if (event.data?.source !== 'netview-interceptor') return

  const { type, payload } = event.data

  if (type === 'request-start') {
    const newRequest: NetworkRequest = {
      id: payload.id,
      timestamp: payload.timestamp!,
      method: payload.method!,
      url: payload.url!,
      requestHeaders: payload.requestHeaders || {},
      requestBody: payload.requestBody || null,
      type: payload.type!,
      source: 'client',
      state: 'pending',
    }

    const currentRequests = store.get(requestsAtom)
    store.set(requestsAtom, [...currentRequests, newRequest])
  } else if (type === 'request-complete' || type === 'request-error') {
    const currentRequests = store.get(requestsAtom)
    store.set(
      requestsAtom,
      currentRequests.map((req) =>
        req.id === payload.id ? { ...req, ...payload } : req
      )
    )
  }
}

// Create Shadow DOM and mount React
const mountPanel = (): void => {
  const host = document.createElement('div')
  host.id = 'netview-root'
  host.style.cssText = 'all: initial; position: fixed; z-index: 2147483647;'

  // Host에서도 이벤트 전파 차단 (Radix Focus Trap이 document 레벨에서 감지하지 못하도록)
  const stopHostPropagation = (e: Event) => e.stopPropagation()
  host.addEventListener('mousedown', stopHostPropagation)
  host.addEventListener('pointerdown', stopHostPropagation)
  host.addEventListener('focusin', stopHostPropagation)
  host.addEventListener('focusout', stopHostPropagation)

  document.body.appendChild(host)

  const shadow = host.attachShadow({ mode: 'open' })

  // Add styles to shadow DOM (including OverlayScrollbars CSS)
  const style = document.createElement('style')
  style.textContent = `
    ${osCss}

    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    :host {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      line-height: 1.5;
      color: #e4e4e7;
    }
  `
  shadow.appendChild(style)

  const container = document.createElement('div')
  container.id = 'netview-container'

  // 모든 이벤트가 Shadow DOM 외부로 버블링되지 않도록 차단
  // Radix UI 등 pointer 이벤트를 사용하는 라이브러리 대응
  const stopPropagation = (e: Event) => e.stopPropagation()
  container.addEventListener('click', stopPropagation)
  container.addEventListener('mousedown', stopPropagation)
  container.addEventListener('mouseup', stopPropagation)
  container.addEventListener('pointerdown', stopPropagation)
  container.addEventListener('pointerup', stopPropagation)
  container.addEventListener('wheel', stopPropagation, { passive: false })
  // 포커스 관련 이벤트 차단 (Radix 모달이 포커스 가로채지 않도록)
  // focus/blur는 bubble되지 않으므로 capture phase에서 차단
  container.addEventListener('focus', stopPropagation, true)
  container.addEventListener('blur', stopPropagation, true)
  container.addEventListener('focusin', stopPropagation)
  container.addEventListener('focusout', stopPropagation)
  // 키보드 이벤트 차단 (Radix Focus Trap의 Tab/Escape 키 트래핑 방지)
  container.addEventListener('keydown', stopPropagation)
  container.addEventListener('keyup', stopPropagation)

  shadow.appendChild(container)

  const root = createRoot(container)
  root.render(
    <Provider store={store}>
      <App />
    </Provider>
  )
}

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

init()
