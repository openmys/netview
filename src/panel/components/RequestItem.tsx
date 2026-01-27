import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import type { NetworkRequest } from '../../shared/types'
import JsonTreeView from './JsonTreeView'
import RawView from './RawView'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'

interface RequestItemProps {
  request: NetworkRequest
  onToggle?: () => void
  onSearchClick?: (requestId: string) => void
  forceExpanded?: boolean
  searchText?: string
  currentMatchIndex?: number
  onMatchCountChange?: (count: number) => void
}

type TabType = 'request' | 'response'
type ViewType = 'json' | 'raw'

// Highlight text component for headers
function HighlightText({
  text,
  searchText,
  currentMatchIndex,
  matchOffset,
  style,
}: {
  text: string
  searchText: string
  currentMatchIndex: number
  matchOffset: number
  style: React.CSSProperties
}) {
  const ref = useRef<HTMLSpanElement>(null)

  // Always call useEffect (Rules of Hooks)
  useEffect(() => {
    if (ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [currentMatchIndex, searchText])

  if (!searchText) {
    return <span style={style}>{text}</span>
  }

  const parts: React.ReactNode[] = []
  const lowerText = text.toLowerCase()
  const lowerSearch = searchText.toLowerCase()
  let lastIndex = 0
  let localMatchIndex = 0

  let pos = lowerText.indexOf(lowerSearch)
  while (pos !== -1) {
    if (pos > lastIndex) {
      parts.push(
        <span key={`text-${localMatchIndex}`} style={style}>
          {text.slice(lastIndex, pos)}
        </span>
      )
    }
    const globalMatchIndex = matchOffset + localMatchIndex
    const isCurrentMatch = globalMatchIndex === currentMatchIndex
    parts.push(
      <span
        key={`match-${localMatchIndex}`}
        ref={isCurrentMatch ? ref : undefined}
        data-highlight-index={globalMatchIndex}
        style={{
          ...style,
          background: isCurrentMatch ? '#f59e0b' : '#f59e0b40',
          color: isCurrentMatch ? '#000' : '#f59e0b',
          borderRadius: '2px',
          padding: '0 1px',
        }}
      >
        {text.slice(pos, pos + searchText.length)}
      </span>
    )
    localMatchIndex++
    lastIndex = pos + searchText.length
    pos = lowerText.indexOf(lowerSearch, lastIndex)
  }
  if (lastIndex < text.length) {
    parts.push(
      <span key="text-end" style={style}>
        {text.slice(lastIndex)}
      </span>
    )
  }

  return <>{parts}</>
}

// Count matches in text
function countTextMatches(text: string, searchText: string): number {
  if (!searchText || !text) return 0
  return text.toLowerCase().split(searchText.toLowerCase()).length - 1
}

// Copy button component
function CopyButton({
  text,
  title,
  style
}: {
  text: string
  title: string
  style?: React.CSSProperties
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }, [text])

  return (
    <button
      onClick={handleCopy}
      title={title}
      style={{
        background: copied ? '#22c55e20' : 'transparent',
        border: 'none',
        color: copied ? '#22c55e' : '#71717a',
        cursor: 'pointer',
        padding: '2px 6px',
        borderRadius: '4px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.15s ease',
        ...style,
      }}
    >
      {copied ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
        </svg>
      )}
    </button>
  )
}

const methodColors: Record<string, string> = {
  GET: '#22c55e',
  POST: '#3b82f6',
  PUT: '#f59e0b',
  PATCH: '#f59e0b',
  DELETE: '#ef4444',
  OPTIONS: '#8b5cf6',
  HEAD: '#6b7280',
}

const sourceColors: Record<string, string> = {
  client: '#3b82f6',  // 파란색
  server: '#8b5cf6',  // 보라색
}

const getStatusColor = (status?: number): string => {
  if (!status) return '#71717a'
  if (status >= 200 && status < 300) return '#22c55e'
  if (status >= 300 && status < 400) return '#3b82f6'
  if (status >= 400 && status < 500) return '#f59e0b'
  return '#ef4444'
}

export default function RequestItem({
  request,
  onToggle,
  onSearchClick,
  forceExpanded = false,
  searchText = '',
  currentMatchIndex = 0,
  onMatchCountChange,
}: RequestItemProps) {
  const [isExpanded, setIsExpanded] = useState(forceExpanded)
  const [activeTab, setActiveTab] = useState<TabType>('response')
  const [viewType, setViewType] = useState<ViewType>('json')
  const [headersCollapsed, setHeadersCollapsed] = useState(false)
  const [bodyCollapsed, setBodyCollapsed] = useState(false)
  const [bodyMatchCount, setBodyMatchCount] = useState(0)

  // Auto-expand headers and body when searching
  useEffect(() => {
    if (searchText) {
      setHeadersCollapsed(false)
      setBodyCollapsed(false)
    }
  }, [searchText])

  // Sync with forceExpanded prop
  useEffect(() => {
    if (forceExpanded) {
      setIsExpanded(true)
    }
  }, [forceExpanded])

  const handleToggle = () => {
    if (!forceExpanded) {
      setIsExpanded(!isExpanded)
      onToggle?.()
    }
  }

  const urlObj = (() => {
    try {
      return new URL(request.url)
    } catch {
      return null
    }
  })()

  const displayUrl = urlObj ? urlObj.pathname + urlObj.search : request.url

  const getCurrentData = useCallback(() => {
    if (activeTab === 'request') {
      return {
        headers: request.requestHeaders,
        body: request.requestBody,
      }
    }
    return {
      headers: request.responseHeaders || {},
      body: request.responseBody || null,
    }
  }, [activeTab, request])

  const data = getCurrentData()

  // Calculate header matches count and offsets
  const headerMatchInfo = useMemo(() => {
    if (!searchText) return { count: 0, offsets: [] as number[] }

    let totalCount = 0
    const offsets: number[] = []

    Object.entries(data.headers).forEach(([key, value]) => {
      offsets.push(totalCount)
      totalCount += countTextMatches(key, searchText) + countTextMatches(value, searchText)
    })

    return { count: totalCount, offsets }
  }, [data.headers, searchText])

  // Calculate total match count and report to parent
  const totalMatchCount = headerMatchInfo.count + bodyMatchCount

  useEffect(() => {
    onMatchCountChange?.(totalMatchCount)
  }, [totalMatchCount, onMatchCountChange])

  // Body match offset starts after headers
  const bodyMatchOffset = headerMatchInfo.count

  const itemStyle: React.CSSProperties = {
    background: '#18181b',
    border: '1px solid #27272a',
    borderRadius: '8px',
    marginBottom: forceExpanded ? '0' : '8px',
    overflow: 'hidden',
  }

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 12px',
    cursor: forceExpanded ? 'default' : 'pointer',
    userSelect: 'none',
  }

  const methodBadgeStyle: React.CSSProperties = {
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 600,
    background: methodColors[request.method] + '20',
    color: methodColors[request.method],
    fontFamily: "'JetBrains Mono', monospace",
  }

  const statusBadgeStyle: React.CSSProperties = {
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 500,
    background: getStatusColor(request.status) + '20',
    color: getStatusColor(request.status),
    fontFamily: "'JetBrains Mono', monospace",
  }

  const tabStyle = (isActive: boolean): React.CSSProperties => ({
    padding: '6px 12px',
    background: isActive ? '#27272a' : 'transparent',
    border: 'none',
    borderRadius: '4px',
    color: isActive ? '#e4e4e7' : '#71717a',
    fontSize: '12px',
    cursor: 'pointer',
    fontWeight: isActive ? 500 : 400,
  })

  const viewToggleStyle = (isActive: boolean): React.CSSProperties => ({
    padding: '4px 8px',
    background: isActive ? '#3f3f46' : 'transparent',
    border: 'none',
    borderRadius: '4px',
    color: isActive ? '#e4e4e7' : '#71717a',
    fontSize: '11px',
    cursor: 'pointer',
  })

  return (
    <div style={itemStyle}>
      {/* Request Header - hide in forceExpanded mode */}
      {!forceExpanded && (
        <div style={headerStyle} onClick={handleToggle}>
          {/* Expand/Collapse arrow */}
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#71717a"
            strokeWidth="2"
            style={{
              transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform 0.15s ease',
            }}
          >
            <path d="M9 18l6-6-6-6" />
          </svg>

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

          <span style={methodBadgeStyle}>{request.method}</span>

          <span
            style={{
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: '#a1a1aa',
              fontSize: '12px',
              fontFamily: "'JetBrains Mono', monospace",
            }}
            title={request.url}
          >
            {displayUrl}
          </span>

          {request.state === 'pending' ? (
            <span style={{ color: '#71717a', fontSize: '11px' }}>Pending...</span>
          ) : request.state === 'error' ? (
            <span style={{ color: '#ef4444', fontSize: '11px' }}>Error</span>
          ) : (
            <>
              <span style={statusBadgeStyle}>{request.status}</span>
              <span style={{ color: '#71717a', fontSize: '11px' }}>
                {request.duration}ms
              </span>
            </>
          )}

          {/* Detail view button */}
          {onSearchClick && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onSearchClick(request.id)
              }}
              title="View details"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#71717a',
                cursor: 'pointer',
                padding: '2px 6px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
              </svg>
            </button>
          )}

          {/* Copy URL button */}
          <CopyButton
            text={
              ['POST', 'PUT', 'PATCH'].includes(request.method) && request.requestBody
                ? `${request.method} ${request.url}\n\nBody:\n${request.requestBody}`
                : request.url
            }
            title={
              ['POST', 'PUT', 'PATCH'].includes(request.method) && request.requestBody
                ? 'Copy URL + Body'
                : 'Copy URL'
            }
          />
        </div>
      )}

      {/* Expanded Content */}
      {isExpanded && (
        <div style={{ borderTop: forceExpanded ? 'none' : '1px solid #27272a', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Tabs */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 12px',
              borderBottom: '1px solid #27272a',
            }}
          >
            <div style={{ display: 'flex', gap: '4px' }}>
              <button style={tabStyle(activeTab === 'request')} onClick={() => setActiveTab('request')}>
                Request
              </button>
              <button style={tabStyle(activeTab === 'response')} onClick={() => setActiveTab('response')}>
                Response
              </button>
            </div>

            <div style={{ display: 'flex', gap: '4px' }}>
              <button style={viewToggleStyle(viewType === 'json')} onClick={() => setViewType('json')}>
                JSON
              </button>
              <button style={viewToggleStyle(viewType === 'raw')} onClick={() => setViewType('raw')}>
                Raw
              </button>
            </div>
          </div>

          {/* Content with internal scroll */}
          <div style={{ padding: '12px', flex: 1, overflow: 'auto' }}>
            {/* Headers */}
            <div style={{ marginBottom: '12px' }}>
              <div
                onClick={() => setHeadersCollapsed(!headersCollapsed)}
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#71717a',
                  marginBottom: headersCollapsed ? '0' : '6px',
                  textTransform: 'uppercase',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  style={{
                    transform: headersCollapsed ? 'rotate(0deg)' : 'rotate(90deg)',
                    transition: 'transform 0.15s ease',
                  }}
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
                Headers
                <span style={{ color: '#52525b', fontWeight: 400 }}>
                  ({Object.keys(data.headers).length})
                </span>
                {Object.keys(data.headers).length > 0 && (
                  <CopyButton
                    text={Object.entries(data.headers)
                      .map(([key, value]) => `${key}: ${value}`)
                      .join('\n')}
                    title="Copy headers"
                  />
                )}
              </div>
              {!headersCollapsed && (
                Object.keys(data.headers).length > 0 ? (
                  <OverlayScrollbarsComponent
                    options={{
                      scrollbars: { theme: 'os-theme-light', autoHide: 'scroll' },
                      overflow: { x: 'scroll', y: 'hidden' },
                    }}
                    style={{
                      background: '#0a0a0a',
                      borderRadius: '6px',
                    }}
                  >
                    <div
                      style={{
                        padding: '8px 12px',
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '11px',
                        width: 'fit-content',
                        minWidth: '100%',
                      }}
                    >
                      {Object.entries(data.headers).map(([key, value], index) => {
                        const keyOffset = headerMatchInfo.offsets[index] || 0
                        const valueOffset = keyOffset + countTextMatches(key, searchText)
                        return (
                          <div key={key} style={{ marginBottom: '4px', whiteSpace: 'nowrap' }}>
                            <HighlightText
                              text={key}
                              searchText={searchText}
                              currentMatchIndex={currentMatchIndex}
                              matchOffset={keyOffset}
                              style={{ color: '#6366f1' }}
                            />
                            <span style={{ color: '#52525b' }}>: </span>
                            <HighlightText
                              text={value}
                              searchText={searchText}
                              currentMatchIndex={currentMatchIndex}
                              matchOffset={valueOffset}
                              style={{ color: '#a1a1aa' }}
                            />
                          </div>
                        )
                      })}
                    </div>
                  </OverlayScrollbarsComponent>
                ) : (
                  <div style={{ color: '#52525b', fontSize: '12px' }}>No headers</div>
                )
              )}
            </div>

            {/* Body */}
            <div>
              <div
                onClick={() => setBodyCollapsed(!bodyCollapsed)}
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#71717a',
                  marginBottom: bodyCollapsed ? '0' : '6px',
                  textTransform: 'uppercase',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  style={{
                    transform: bodyCollapsed ? 'rotate(0deg)' : 'rotate(90deg)',
                    transition: 'transform 0.15s ease',
                  }}
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
                Body
                {data.body && (
                  <CopyButton
                    text={data.body}
                    title="Copy body"
                  />
                )}
              </div>
              {!bodyCollapsed && (
                data.body ? (
                  viewType === 'json' ? (
                    <JsonTreeView
                      data={data.body}
                      searchText={searchText}
                      currentMatchIndex={currentMatchIndex - bodyMatchOffset}
                      onMatchCountChange={setBodyMatchCount}
                    />
                  ) : (
                    <RawView
                      data={data.body}
                      searchText={searchText}
                      currentMatchIndex={currentMatchIndex - bodyMatchOffset}
                    />
                  )
                ) : (
                  <div style={{ color: '#52525b', fontSize: '12px' }}>No body</div>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
