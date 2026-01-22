import { useState, useMemo, useEffect, useRef } from 'react'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'

interface JsonTreeViewProps {
  data: string
  searchText?: string
  currentMatchIndex?: number
  onMatchCountChange?: (count: number) => void
}

interface JsonNodeProps {
  keyName?: string
  value: unknown
  depth?: number
  isLast?: boolean
  searchText?: string
  currentMatchIndex?: number
  matchOffset?: number
}

const INITIAL_ITEMS_TO_SHOW = 10
const ITEMS_PER_LOAD = 20

// Check if a value contains the search text (recursively for objects/arrays)
function containsSearchText(value: unknown, searchText: string): boolean {
  if (!searchText) return false
  const lowerSearch = searchText.toLowerCase()

  if (value === null) return 'null'.includes(lowerSearch)
  if (typeof value === 'string') return value.toLowerCase().includes(lowerSearch)
  if (typeof value === 'number') return value.toString().includes(lowerSearch)
  if (typeof value === 'boolean') return value.toString().includes(lowerSearch)

  if (Array.isArray(value)) {
    return value.some((item) => containsSearchText(item, searchText))
  }

  if (typeof value === 'object') {
    return Object.entries(value as object).some(
      ([key, val]) => key.toLowerCase().includes(lowerSearch) || containsSearchText(val, searchText)
    )
  }

  return false
}

// Count matches in a value (recursively)
function countMatches(value: unknown, searchText: string): number {
  if (!searchText) return 0
  const lowerSearch = searchText.toLowerCase()

  if (value === null) {
    return 'null'.toLowerCase().split(lowerSearch).length - 1
  }
  if (typeof value === 'string') {
    return value.toLowerCase().split(lowerSearch).length - 1
  }
  if (typeof value === 'number') {
    return value.toString().toLowerCase().split(lowerSearch).length - 1
  }
  if (typeof value === 'boolean') {
    return value.toString().toLowerCase().split(lowerSearch).length - 1
  }

  if (Array.isArray(value)) {
    return value.reduce((sum, item) => sum + countMatches(item, searchText), 0)
  }

  if (typeof value === 'object') {
    return Object.entries(value as object).reduce((sum, [key, val]) => {
      const keyMatches = key.toLowerCase().split(lowerSearch).length - 1
      return sum + keyMatches + countMatches(val, searchText)
    }, 0)
  }

  return 0
}

// Highlight text component
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

function JsonNode({
  keyName,
  value,
  depth = 0,
  isLast = true,
  searchText = '',
  currentMatchIndex = 0,
  matchOffset = 0,
}: JsonNodeProps) {
  const hasSearchMatch = searchText ? containsSearchText(value, searchText) : false

  // Auto-expand when searching and this node contains matches
  const [isExpanded, setIsExpanded] = useState(true)
  const [visibleCount, setVisibleCount] = useState(INITIAL_ITEMS_TO_SHOW)

  // Show all items when searching
  useEffect(() => {
    if (searchText && hasSearchMatch) {
      setIsExpanded(true)
      if (Array.isArray(value)) {
        setVisibleCount(value.length) // Show all items when searching
      }
    }
  }, [searchText, hasSearchMatch, value])

  const indent = depth * 16

  const keyStyle: React.CSSProperties = {
    color: '#6366f1',
    marginRight: '4px',
  }

  const punctuationStyle: React.CSSProperties = {
    color: '#52525b',
  }

  const stringStyle: React.CSSProperties = {
    color: '#22c55e',
  }

  const numberStyle: React.CSSProperties = {
    color: '#f59e0b',
  }

  const booleanStyle: React.CSSProperties = {
    color: '#3b82f6',
  }

  const nullStyle: React.CSSProperties = {
    color: '#ef4444',
  }

  // Calculate match offset for key
  const keyMatchCount = keyName && searchText
    ? keyName.toLowerCase().split(searchText.toLowerCase()).length - 1
    : 0

  const renderValue = () => {
    let currentOffset = matchOffset + keyMatchCount

    if (value === null) {
      return (
        <HighlightText
          text="null"
          searchText={searchText}
          currentMatchIndex={currentMatchIndex}
          matchOffset={currentOffset}
          style={nullStyle}
        />
      )
    }

    if (typeof value === 'string') {
      // Check if it's a URL
      const isUrl = value.startsWith('http://') || value.startsWith('https://')
      const displayValue = isUrl && value.length > 50 ? value.slice(0, 50) + '...' : value
      return (
        <span style={stringStyle}>
          "
          <HighlightText
            text={displayValue}
            searchText={searchText}
            currentMatchIndex={currentMatchIndex}
            matchOffset={currentOffset}
            style={stringStyle}
          />
          "
        </span>
      )
    }

    if (typeof value === 'number') {
      return (
        <HighlightText
          text={value.toString()}
          searchText={searchText}
          currentMatchIndex={currentMatchIndex}
          matchOffset={currentOffset}
          style={numberStyle}
        />
      )
    }

    if (typeof value === 'boolean') {
      return (
        <HighlightText
          text={value.toString()}
          searchText={searchText}
          currentMatchIndex={currentMatchIndex}
          matchOffset={currentOffset}
          style={booleanStyle}
        />
      )
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return <span style={punctuationStyle}>[]</span>
      }

      const visibleItems = searchText ? value : value.slice(0, visibleCount)
      const hasMore = !searchText && value.length > visibleCount
      const remainingCount = value.length - visibleCount

      // Calculate offsets for each child
      let childOffset = currentOffset
      const childOffsets: number[] = []
      for (const item of value) {
        childOffsets.push(childOffset)
        childOffset += countMatches(item, searchText)
      }

      return (
        <span>
          <span
            onClick={() => setIsExpanded(!isExpanded)}
            style={{ cursor: 'pointer', userSelect: 'none' }}
          >
            <span style={punctuationStyle}>[</span>
            {!isExpanded && (
              <span style={{ color: '#71717a', fontSize: '11px' }}>
                {' '}{value.length} items{' '}
              </span>
            )}
          </span>
          {isExpanded && (
            <>
              <div>
                {visibleItems.map((item, index) => (
                  <div key={index} style={{ paddingLeft: `${indent + 16}px` }}>
                    <JsonNode
                      value={item}
                      depth={depth + 1}
                      isLast={!hasMore && index === visibleItems.length - 1}
                      searchText={searchText}
                      currentMatchIndex={currentMatchIndex}
                      matchOffset={childOffsets[index]}
                    />
                  </div>
                ))}
                {hasMore && (
                  <div style={{ paddingLeft: `${indent + 16}px` }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setVisibleCount(prev => prev + ITEMS_PER_LOAD)
                      }}
                      style={{
                        background: '#27272a',
                        border: '1px solid #3f3f46',
                        borderRadius: '4px',
                        color: '#a1a1aa',
                        fontSize: '10px',
                        padding: '2px 8px',
                        cursor: 'pointer',
                        marginTop: '4px',
                      }}
                    >
                      Show {Math.min(remainingCount, ITEMS_PER_LOAD)} more ({remainingCount} remaining)
                    </button>
                  </div>
                )}
              </div>
              <span style={{ ...punctuationStyle, paddingLeft: `${indent}px` }}>]</span>
            </>
          )}
          {!isExpanded && <span style={punctuationStyle}>]</span>}
        </span>
      )
    }

    if (typeof value === 'object') {
      const entries = Object.entries(value as object)

      if (entries.length === 0) {
        return <span style={punctuationStyle}>{'{}'}</span>
      }

      // Calculate offsets for each child
      let childOffset = currentOffset
      const childOffsets: number[] = []
      for (const [key, val] of entries) {
        childOffsets.push(childOffset)
        const keyMatches = key.toLowerCase().split((searchText || '').toLowerCase()).length - 1
        childOffset += keyMatches + countMatches(val, searchText)
      }

      return (
        <span>
          <span
            onClick={() => setIsExpanded(!isExpanded)}
            style={{ cursor: 'pointer', userSelect: 'none' }}
          >
            <span style={punctuationStyle}>{'{'}</span>
            {!isExpanded && (
              <span style={{ color: '#71717a', fontSize: '11px' }}>
                {' '}{entries.length} keys{' '}
              </span>
            )}
          </span>
          {isExpanded && (
            <>
              <div>
                {entries.map(([key, val], index) => (
                  <div key={key} style={{ paddingLeft: `${indent + 16}px` }}>
                    <JsonNode
                      keyName={key}
                      value={val}
                      depth={depth + 1}
                      isLast={index === entries.length - 1}
                      searchText={searchText}
                      currentMatchIndex={currentMatchIndex}
                      matchOffset={childOffsets[index]}
                    />
                  </div>
                ))}
              </div>
              <span style={{ ...punctuationStyle, paddingLeft: `${indent}px` }}>{'}'}</span>
            </>
          )}
          {!isExpanded && <span style={punctuationStyle}>{'}'}</span>}
        </span>
      )
    }

    return <span style={{ color: '#a1a1aa' }}>{String(value)}</span>
  }

  return (
    <div style={{ lineHeight: '1.6' }}>
      {keyName !== undefined && (
        <>
          <span style={keyStyle}>
            "
            <HighlightText
              text={keyName}
              searchText={searchText}
              currentMatchIndex={currentMatchIndex}
              matchOffset={matchOffset}
              style={keyStyle}
            />
            "
          </span>
          <span style={punctuationStyle}>: </span>
        </>
      )}
      {renderValue()}
      {!isLast && <span style={punctuationStyle}>,</span>}
    </div>
  )
}

export default function JsonTreeView({
  data,
  searchText = '',
  currentMatchIndex = 0,
  onMatchCountChange,
}: JsonTreeViewProps) {
  const parsedData = useMemo(() => {
    try {
      return JSON.parse(data)
    } catch {
      return null
    }
  }, [data])

  // Count total matches
  const totalMatches = useMemo(() => {
    if (!searchText || parsedData === null) {
      // For non-JSON, count matches in raw data
      if (parsedData === null && searchText) {
        return data.toLowerCase().split(searchText.toLowerCase()).length - 1
      }
      return 0
    }
    return countMatches(parsedData, searchText)
  }, [parsedData, searchText, data])

  // Report match count to parent
  useEffect(() => {
    onMatchCountChange?.(totalMatches)
  }, [totalMatches, onMatchCountChange])

  const containerStyle: React.CSSProperties = {
    background: '#0a0a0a',
    borderRadius: '6px',
  }

  const contentStyle: React.CSSProperties = {
    padding: '12px',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '11px',
    width: 'fit-content',
    minWidth: '100%',
  }

  if (parsedData === null) {
    // Not valid JSON, show as raw text with highlighting
    return (
      <OverlayScrollbarsComponent
        options={{
          scrollbars: { theme: 'os-theme-light', autoHide: 'scroll' },
          overflow: { x: 'scroll', y: 'hidden' },
        }}
        style={containerStyle}
      >
        <div style={contentStyle}>
          <HighlightText
            text={data}
            searchText={searchText}
            currentMatchIndex={currentMatchIndex}
            matchOffset={0}
            style={{ color: '#a1a1aa', whiteSpace: 'pre', display: 'block' }}
          />
        </div>
      </OverlayScrollbarsComponent>
    )
  }

  return (
    <OverlayScrollbarsComponent
      options={{
        scrollbars: { theme: 'os-theme-light', autoHide: 'scroll' },
        overflow: { x: 'scroll', y: 'hidden' },
      }}
      style={containerStyle}
    >
      <div style={contentStyle}>
        <JsonNode
          value={parsedData}
          searchText={searchText}
          currentMatchIndex={currentMatchIndex}
          matchOffset={0}
        />
      </div>
    </OverlayScrollbarsComponent>
  )
}
