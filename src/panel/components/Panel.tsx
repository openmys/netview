import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import {
  filteredRequestsAtom,
  filterAtom,
  clearRequestsAtom,
  togglePanelAtom,
  detailViewAtom,
  requestsAtom,
  panelWidthAtom,
  setPanelWidthAtom,
  MIN_PANEL_WIDTH,
  MAX_PANEL_WIDTH,
} from '../stores/atoms'
import RequestItem from './RequestItem'
import { useRef, useEffect, useState, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'
import type { OverlayScrollbarsComponentRef } from 'overlayscrollbars-react'
import 'overlayscrollbars/overlayscrollbars.css'

const methodColors: Record<string, string> = {
  GET: '#22c55e',
  POST: '#3b82f6',
  PUT: '#f59e0b',
  PATCH: '#f59e0b',
  DELETE: '#ef4444',
  OPTIONS: '#8b5cf6',
  HEAD: '#6b7280',
}

export default function Panel() {
  const requests = useAtomValue(filteredRequestsAtom)
  const allRequests = useAtomValue(requestsAtom)
  const [filter, setFilter] = useAtom(filterAtom)
  const [detailView, setDetailView] = useAtom(detailViewAtom)
  const clearRequests = useSetAtom(clearRequestsAtom)
  const togglePanel = useSetAtom(togglePanelAtom)
  const panelWidth = useAtomValue(panelWidthAtom)
  const setPanelWidth = useSetAtom(setPanelWidthAtom)
  const osRef = useRef<OverlayScrollbarsComponentRef>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const prevRequestsLength = useRef(requests.length)
  const [isResizing, setIsResizing] = useState(false)
  const resizeStartX = useRef(0)
  const resizeStartWidth = useRef(0)

  // Get the selected request for detail search mode
  const selectedRequest = detailView.requestId
    ? allRequests.find(r => r.id === detailView.requestId)
    : null

  // Item height constant
  const COLLAPSED_HEIGHT = 44 // header height + margin

  // Force re-render when OverlayScrollbars initializes
  const [, forceUpdate] = useState(0)

  // Get scroll element from OverlayScrollbars
  const getScrollElement = useCallback(() => {
    return osRef.current?.osInstance()?.elements().viewport ?? null
  }, [])

  // Virtualizer setup
  const virtualizer = useVirtualizer({
    count: requests.length,
    getScrollElement,
    estimateSize: () => COLLAPSED_HEIGHT,
    overscan: 3,
  })

  // Handle OverlayScrollbars initialization - force virtualizer to recalculate and scroll to bottom
  const handleOsInitialized = useCallback(() => {
    forceUpdate(n => n + 1)
    // Trigger virtualizer measure and scroll to bottom after a tick
    setTimeout(() => {
      virtualizer.measure()
      // Scroll to bottom when panel opens
      if (requests.length > 0) {
        virtualizer.scrollToIndex(requests.length - 1, { align: 'end' })
      }
    }, 0)
  }, [virtualizer, requests.length])

  // Auto-scroll to bottom when new requests come in (only if autoScroll is enabled)
  useEffect(() => {
    if (autoScroll && requests.length > prevRequestsLength.current && requests.length > 0) {
      virtualizer.scrollToIndex(requests.length - 1, { align: 'end' })
    }
    prevRequestsLength.current = requests.length
  }, [requests.length, autoScroll, virtualizer])

  // Detect user scroll to disable auto-scroll
  const handleScroll = useCallback(() => {
    const viewport = getScrollElement()
    if (!viewport) return

    const { scrollTop, scrollHeight, clientHeight } = viewport
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50 // 50px threshold

    // If user scrolled away from bottom, disable auto-scroll
    if (!isAtBottom && autoScroll) {
      setAutoScroll(false)
    }
  }, [autoScroll, getScrollElement])

  // Scroll to bottom manually
  const scrollToBottom = useCallback(() => {
    if (requests.length > 0) {
      virtualizer.scrollToIndex(requests.length - 1, { align: 'end' })
    }
  }, [requests.length, virtualizer])

  // Resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
    resizeStartX.current = e.clientX
    resizeStartWidth.current = panelWidth
  }, [panelWidth])

  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      // Panel is on the right side, so dragging left increases width
      const deltaX = resizeStartX.current - e.clientX
      const newWidth = resizeStartWidth.current + deltaX
      setPanelWidth(Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, newWidth)))
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, setPanelWidth])

  const panelStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: '90px',
    right: '20px',
    width: `${panelWidth}px`,
    height: '600px',
    background: '#09090b',
    border: '1px solid #27272a',
    borderRadius: '12px',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontSize: '13px',
    color: '#e4e4e7',
  }

  const resizeHandleStyle: React.CSSProperties = {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '6px',
    cursor: 'ew-resize',
    background: isResizing ? '#6366f1' : 'transparent',
    transition: isResizing ? 'none' : 'background 0.15s ease',
    zIndex: 10,
  }

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    borderBottom: '1px solid #27272a',
    background: '#18181b',
  }

  const buttonStyle: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    color: '#a1a1aa',
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.15s ease',
  }

  const inputStyle: React.CSSProperties = {
    flex: 1,
    background: '#27272a',
    border: '1px solid #3f3f46',
    borderRadius: '6px',
    padding: '6px 12px',
    color: '#e4e4e7',
    fontSize: '13px',
    outline: 'none',
  }

  const checkboxLabelStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '11px',
    color: autoScroll ? '#6366f1' : '#71717a',
    cursor: 'pointer',
    userSelect: 'none',
  }

  return (
    <div style={panelStyle}>
      {/* Resize handle */}
      <div
        style={resizeHandleStyle}
        onMouseDown={handleResizeStart}
        onMouseEnter={(e) => {
          if (!isResizing) {
            (e.target as HTMLElement).style.background = '#3f3f46'
          }
        }}
        onMouseLeave={(e) => {
          if (!isResizing) {
            (e.target as HTMLElement).style.background = 'transparent'
          }
        }}
      />

      {/* Header */}
      <div style={headerStyle}>
        {detailView.requestId && selectedRequest ? (
          // Detail view mode header
          <>
            <button
              onClick={() => setDetailView({ requestId: null, searchText: '', currentMatchIndex: 0, totalMatches: 0 })}
              style={{
                ...buttonStyle,
                padding: '4px',
              }}
              title="Back to all requests"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>

            {/* Search input with navigation */}
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              minWidth: 0,
            }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#71717a"
                  strokeWidth="2"
                  style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)' }}
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
                <input
                  type="text"
                  placeholder="Search in request..."
                  value={detailView.searchText}
                  onChange={(e) => setDetailView({ ...detailView, searchText: e.target.value, currentMatchIndex: 0 })}
                  onKeyDown={(e) => {
                    if (detailView.totalMatches > 0) {
                      if (e.key === 'Enter' || e.key === 'ArrowDown') {
                        e.preventDefault()
                        setDetailView({
                          ...detailView,
                          currentMatchIndex: (detailView.currentMatchIndex + 1) % detailView.totalMatches
                        })
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault()
                        setDetailView({
                          ...detailView,
                          currentMatchIndex: (detailView.currentMatchIndex - 1 + detailView.totalMatches) % detailView.totalMatches
                        })
                      }
                    }
                  }}
                  style={{
                    ...inputStyle,
                    paddingLeft: '28px',
                    paddingRight: detailView.searchText ? '70px' : '8px',
                    fontSize: '12px',
                  }}
                  autoFocus
                />
                {detailView.searchText && (
                  <div style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}>
                    <span style={{ fontSize: '10px', color: detailView.totalMatches > 0 ? '#a1a1aa' : '#ef4444' }}>
                      {detailView.totalMatches > 0
                        ? `${detailView.currentMatchIndex + 1}/${detailView.totalMatches}`
                        : 'No results'}
                    </span>
                    {detailView.totalMatches > 1 && (
                      <>
                        <button
                          onClick={() => setDetailView({
                            ...detailView,
                            currentMatchIndex: (detailView.currentMatchIndex - 1 + detailView.totalMatches) % detailView.totalMatches
                          })}
                          style={{ ...buttonStyle, padding: '2px' }}
                          title="Previous (↑)"
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 15l-6-6-6 6" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setDetailView({
                            ...detailView,
                            currentMatchIndex: (detailView.currentMatchIndex + 1) % detailView.totalMatches
                          })}
                          style={{ ...buttonStyle, padding: '2px' }}
                          title="Next (↓/Enter)"
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M6 9l6 6 6-6" />
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Request info badge */}
            <div style={{
              fontSize: '10px',
              color: '#a1a1aa',
              background: '#27272a',
              padding: '4px 8px',
              borderRadius: '4px',
              maxWidth: '150px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }} title={selectedRequest.url}>
              <span style={{ color: methodColors[selectedRequest.method] || '#71717a', fontWeight: 500 }}>
                {selectedRequest.method}
              </span>
              {' '}
              {(() => { try { return new URL(selectedRequest.url).pathname } catch { return selectedRequest.url } })()}
            </div>
          </>
        ) : (
          // Normal mode header
          <>
            <input
              type="text"
              placeholder="Filter by URL, method, status..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={inputStyle}
            />

            {/* Auto-scroll checkbox */}
            <label style={checkboxLabelStyle} title="Auto-scroll to new requests">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                style={{
                  width: '14px',
                  height: '14px',
                  cursor: 'pointer',
                  accentColor: '#6366f1',
                }}
              />
              Auto
            </label>

            <button
              onClick={() => clearRequests()}
              style={buttonStyle}
              title="Clear all"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              </svg>
            </button>

            <button onClick={() => togglePanel()} style={buttonStyle} title="Hide">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </>
        )}
      </div>

      {/* Content Area */}
      {detailView.requestId && selectedRequest ? (
        // Detail view mode - show single request expanded
        <OverlayScrollbarsComponent
          options={{
            scrollbars: {
              theme: 'os-theme-light',
              autoHide: 'scroll',
            },
          }}
          style={{
            flex: 1,
            padding: '8px',
          }}
        >
          <RequestItem
            request={selectedRequest}
            forceExpanded
            searchText={detailView.searchText}
            currentMatchIndex={detailView.currentMatchIndex}
            onMatchCountChange={(count) => {
              if (count !== detailView.totalMatches) {
                setDetailView({ ...detailView, totalMatches: count })
              }
            }}
          />
        </OverlayScrollbarsComponent>
      ) : (
        // Normal mode - virtualized list
        <OverlayScrollbarsComponent
          ref={osRef}
          options={{
            scrollbars: {
              theme: 'os-theme-light',
              autoHide: 'never',
            },
          }}
          events={{
            initialized: handleOsInitialized,
            scroll: handleScroll,
          }}
          style={{
            flex: 1,
            padding: '8px',
            position: 'relative',
          }}
        >
          {requests.length === 0 ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: '#71717a',
              }}
            >
              No requests captured yet
            </div>
          ) : (
            <div
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {virtualizer.getVirtualItems().map((virtualItem) => {
                const request = requests[virtualItem.index]

                return (
                  <div
                    key={request.id}
                    data-index={virtualItem.index}
                    ref={virtualizer.measureElement}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualItem.start}px)`,
                    }}
                  >
                    <RequestItem
                      request={request}
                      onToggle={() => setAutoScroll(false)}
                      onSearchClick={(requestId) => {
                        setDetailView({ requestId, searchText: '', currentMatchIndex: 0, totalMatches: 0 })
                      }}
                    />
                  </div>
                )
              })}
            </div>
          )}
        </OverlayScrollbarsComponent>
      )}

      {/* Footer bar with scroll button */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '6px 12px',
          borderTop: '1px solid #27272a',
          background: '#18181b',
        }}
      >
        <button
          onClick={scrollToBottom}
          disabled={autoScroll || requests.length === 0}
          style={{
            background: 'transparent',
            border: 'none',
            color: autoScroll || requests.length === 0 ? '#3f3f46' : '#71717a',
            cursor: autoScroll || requests.length === 0 ? 'default' : 'pointer',
            padding: '2px 6px',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            fontSize: '10px',
            transition: 'all 0.15s ease',
          }}
          title="Scroll to bottom"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12l7 7 7-7" />
          </svg>
          Scroll to bottom
        </button>
      </div>
    </div>
  )
}
