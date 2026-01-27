import type { NetworkRequest, HttpMethod } from '../shared/types'

const endpoints = [
  { method: 'GET', url: '/api/users', successRate: 0.95 },
  { method: 'GET', url: '/api/posts', successRate: 0.9 },
  { method: 'GET', url: '/api/comments', successRate: 0.85 },
  { method: 'POST', url: '/api/users', successRate: 0.9 },
  { method: 'POST', url: '/api/posts', successRate: 0.85 },
  { method: 'PUT', url: '/api/users/1', successRate: 0.8 },
  { method: 'PUT', url: '/api/posts/1', successRate: 0.75 },
  { method: 'DELETE', url: '/api/users/1', successRate: 0.9 },
  { method: 'DELETE', url: '/api/posts/1', successRate: 0.85 },
  { method: 'PATCH', url: '/api/users/1/status', successRate: 0.9 },
  { method: 'GET', url: '/api/products', successRate: 0.95 },
  { method: 'GET', url: '/api/orders', successRate: 0.8 },
  { method: 'POST', url: '/api/orders', successRate: 0.7 },
  { method: 'GET', url: '/api/analytics/dashboard', successRate: 0.6 },
  { method: 'GET', url: '/api/logs/application/detailed-trace-with-very-long-path-for-testing-horizontal-scroll', successRate: 0.95 },
  { method: 'GET', url: '/api/long-content', successRate: 0.95 },
] as const

const sampleResponseBodies: Record<string, unknown> = {
  '/api/users': {
    users: [
      { id: 1, name: 'John Doe', email: 'john@example.com', role: 'admin' },
      { id: 2, name: 'Jane Smith', email: 'jane@example.com', role: 'user' },
      { id: 3, name: 'Bob Wilson', email: 'bob@example.com', role: 'user' },
    ],
    total: 3,
    page: 1,
  },
  '/api/posts': {
    posts: [
      { id: 1, title: 'Hello World', author: 'John', likes: 42 },
      { id: 2, title: 'React Tips', author: 'Jane', likes: 128 },
    ],
    total: 2,
  },
  '/api/comments': {
    comments: [
      { id: 1, postId: 1, text: 'Great post!', author: 'Bob' },
      { id: 2, postId: 1, text: 'Thanks for sharing', author: 'Alice' },
    ],
  },
  '/api/products': {
    products: [
      { id: 1, name: 'Laptop', price: 999.99, stock: 50 },
      { id: 2, name: 'Mouse', price: 29.99, stock: 200 },
      { id: 3, name: 'Keyboard', price: 79.99, stock: 150 },
    ],
  },
  '/api/orders': {
    orders: [
      { id: 1, userId: 1, total: 1029.98, status: 'shipped' },
      { id: 2, userId: 2, total: 79.99, status: 'pending' },
    ],
  },
  '/api/analytics/dashboard': {
    visitors: 15234,
    pageViews: 45678,
    bounceRate: 0.32,
    avgSessionDuration: 245,
  },
  '/api/logs/application/detailed-trace-with-very-long-path-for-testing-horizontal-scroll': {
    logs: [
      { timestamp: '2024-01-15T10:30:45.123Z', level: 'INFO', message: 'Application started successfully with configuration loaded from /etc/myapp/config.yaml' },
      { timestamp: '2024-01-15T10:30:45.456Z', level: 'DEBUG', message: 'Database connection pool initialized with maxConnections=100, minConnections=10, connectionTimeout=30000ms' },
      { timestamp: '2024-01-15T10:30:46.789Z', level: 'WARN', message: 'Cache server at redis://cache.internal.example.com:6379 responded slowly (latency: 250ms), consider scaling up' },
    ],
    totalCount: 15000,
    veryLongHeaderValue: 'Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6InNpZ25pbmcta2V5LTEyMzQ1Njc4OTAifQ.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWUsImlhdCI6MTUxNjIzOTAyMiwiZXhwIjoxNTE2MzI1NDIyfQ.signature-here-that-is-also-very-long',
  },
  '/api/long-content': {
    description: 'This is a very long description that spans multiple characters to test horizontal scrolling in the JSON tree view and raw view components. It contains technical details about the API endpoint including authentication methods, rate limiting policies, and usage examples.',
    longArray: Array.from({ length: 20 }, (_, i) => ({
      id: i + 1,
      name: `Item ${i + 1} with a moderately long name for testing purposes`,
      metadata: {
        createdAt: new Date().toISOString(),
        updatedBy: `user_${i + 1}@company.example.com`,
        tags: ['tag1', 'tag2', 'tag3', 'very-long-tag-name-for-testing'],
      },
    })),
    nestedObject: {
      level1: {
        level2: {
          level3: {
            level4: {
              deepValue: 'This is a deeply nested value that tests the horizontal scroll behavior of the JSON tree view',
            },
          },
        },
      },
    },
  },
}

const errorResponses = [
  { status: 400, body: { error: 'Bad Request', message: 'Invalid parameters' } },
  { status: 401, body: { error: 'Unauthorized', message: 'Authentication required' } },
  { status: 403, body: { error: 'Forbidden', message: 'Access denied' } },
  { status: 404, body: { error: 'Not Found', message: 'Resource not found' } },
  { status: 500, body: { error: 'Internal Server Error', message: 'Something went wrong' } },
  { status: 502, body: { error: 'Bad Gateway', message: 'Upstream server error' } },
  { status: 503, body: { error: 'Service Unavailable', message: 'Server is overloaded' } },
]

let requestCounter = 100

function generateId(): string {
  return `sim-${++requestCounter}-${Math.random().toString(36).substring(2, 7)}`
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function generateRequest(): NetworkRequest {
  const endpoint = endpoints[randomInt(0, endpoints.length - 1)]
  const isSuccess = Math.random() < endpoint.successRate
  const duration = randomInt(50, 2000)
  const id = generateId()
  const baseUrl = 'https://api.example.com'

  const requestHeaders: Record<string, string> = {
    'Accept': 'application/json',
    'Authorization': 'Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6InNpZ25pbmcta2V5LTEyMzQ1Njc4OTAifQ.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWUsImlhdCI6MTUxNjIzOTAyMiwiZXhwIjoxNTE2MzI1NDIyfQ.signature-here',
    'X-Request-ID': id,
    'X-Correlation-ID': `corr-${id}-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`,
  }

  let requestBody: string | null = null
  if (['POST', 'PUT', 'PATCH'].includes(endpoint.method)) {
    requestHeaders['Content-Type'] = 'application/json'
    requestBody = JSON.stringify({
      name: 'Test User',
      email: `user${randomInt(1, 100)}@example.com`,
      timestamp: Date.now(),
    })
  }

  if (isSuccess) {
    const baseResponseBody = sampleResponseBodies[endpoint.url] || { success: true }
    const responseBody = {
      ...baseResponseBody,
      _meta: { requestId: id, timestamp: Date.now() },
    }

    return {
      id,
      timestamp: Date.now(),
      method: endpoint.method as HttpMethod,
      url: `${baseUrl}${endpoint.url}`,
      requestHeaders,
      requestBody,
      status: endpoint.method === 'POST' ? 201 : 200,
      statusText: endpoint.method === 'POST' ? 'Created' : 'OK',
      responseHeaders: {
        'Content-Type': 'application/json',
        'X-Request-ID': id,
        'X-Response-Time': `${duration}ms`,
      },
      responseBody: JSON.stringify(responseBody),
      duration,
      type: Math.random() > 0.3 ? 'fetch' : 'xhr',
      source: Math.random() > 0.5 ? 'client' : 'server',
      state: 'completed',
    }
  } else {
    const error = errorResponses[randomInt(0, errorResponses.length - 1)]
    return {
      id,
      timestamp: Date.now(),
      method: endpoint.method as HttpMethod,
      url: `${baseUrl}${endpoint.url}`,
      requestHeaders,
      requestBody,
      status: error.status,
      statusText: error.body.error,
      responseHeaders: {
        'Content-Type': 'application/json',
        'X-Request-ID': id,
      },
      responseBody: JSON.stringify({ ...error.body, requestId: id }),
      duration,
      type: Math.random() > 0.3 ? 'fetch' : 'xhr',
      source: Math.random() > 0.5 ? 'client' : 'server',
      state: 'completed',
    }
  }
}

export function startApiSimulation(
  onNewRequest: (request: NetworkRequest) => void,
  intervalMs: number = 1500
): () => void {
  // Generate initial batch
  for (let i = 0; i < 3; i++) {
    setTimeout(() => {
      onNewRequest(generateRequest())
    }, i * 300)
  }

  // Continue generating periodically with some randomness
  const interval = setInterval(() => {
    onNewRequest(generateRequest())

    // Sometimes generate burst of requests
    if (Math.random() > 0.7) {
      setTimeout(() => onNewRequest(generateRequest()), 200)
    }
    if (Math.random() > 0.9) {
      setTimeout(() => onNewRequest(generateRequest()), 400)
    }
  }, intervalMs + randomInt(-500, 500))

  return () => clearInterval(interval)
}
