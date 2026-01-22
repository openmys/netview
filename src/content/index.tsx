import { createRoot } from 'react-dom/client'
import { Provider } from 'jotai'
import App from '../panel/App'
import type { InterceptorMessage, NetworkRequest } from '../shared/types'
import { requestsAtom } from '../panel/stores/atoms'
import { createStore } from 'jotai'
import osCss from 'overlayscrollbars/overlayscrollbars.css?inline'

// Create Jotai store for external updates
const store = createStore()

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
  injectInterceptor()
  window.addEventListener('message', handleMessage)

  if (document.body) {
    mountPanel()
  } else {
    document.addEventListener('DOMContentLoaded', mountPanel)
  }
}

init()
