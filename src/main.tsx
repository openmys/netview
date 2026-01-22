import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider, useSetAtom } from 'jotai'
import { createStore } from 'jotai'
import App from './panel/App'
import { requestsAtom, panelStateAtom, addRequestAtom } from './panel/stores/atoms'
import { startApiSimulation } from './dev/apiSimulator'
import './index.css'

// Create Jotai store
const store = createStore()
store.set(requestsAtom, [])
store.set(panelStateAtom, {
  isOpen: true,
  isMinimized: false,
  position: { x: 0, y: 0 },
  size: { width: 450, height: 600 },
})

// Component that runs the API simulation
function ApiSimulator() {
  const addRequest = useSetAtom(addRequestAtom)

  useEffect(() => {
    const stop = startApiSimulation((request) => {
      addRequest(request)
    }, 2000) // New request every ~2 seconds

    return stop
  }, [addRequest])

  return null
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <div
        style={{
          minHeight: '100vh',
          background: '#1a1a2e',
          padding: '20px',
        }}
      >
        <h1 style={{ color: '#fff', marginBottom: '10px', fontFamily: 'sans-serif', fontSize: '24px' }}>
          NetView Dev Mode
        </h1>
        <p style={{ color: '#888', marginBottom: '20px', fontFamily: 'sans-serif', fontSize: '14px' }}>
          API requests are being simulated. Watch the panel on the right.
        </p>
        <div style={{ color: '#666', fontFamily: 'monospace', fontSize: '12px' }}>
          <p>• New requests generated every ~2 seconds</p>
          <p>• Mix of GET, POST, PUT, DELETE, PATCH methods</p>
          <p>• Random success/error responses</p>
          <p>• Try scrolling up to disable auto-scroll</p>
        </div>
        <ApiSimulator />
        <App />
      </div>
    </Provider>
  </StrictMode>
)
