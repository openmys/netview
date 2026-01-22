import { useMemo, useEffect, useRef } from 'react'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'

interface RawViewProps {
  data: string
  searchText?: string
  currentMatchIndex?: number
  onMatchesFound?: (matches: { index: number; element: HTMLElement }[]) => void
}

// Highlight text with search matches
function HighlightedText({
  text,
  searchText,
  currentMatchIndex = 0,
  onMatchesFound,
}: {
  text: string
  searchText: string
  currentMatchIndex: number
  onMatchesFound?: (matches: { index: number; element: HTMLElement }[]) => void
}) {
  const containerRef = useRef<HTMLPreElement>(null)

  useEffect(() => {
    if (!containerRef.current || !searchText) {
      onMatchesFound?.([])
      return
    }

    const highlights = containerRef.current.querySelectorAll('[data-highlight-index]')
    const matches: { index: number; element: HTMLElement }[] = []
    highlights.forEach((el) => {
      const idx = parseInt(el.getAttribute('data-highlight-index') || '0', 10)
      matches.push({ index: idx, element: el as HTMLElement })
    })
    onMatchesFound?.(matches)
  }, [searchText, onMatchesFound])

  // Scroll to current match
  useEffect(() => {
    if (!containerRef.current || !searchText) return
    const currentEl = containerRef.current.querySelector(`[data-highlight-index="${currentMatchIndex}"]`)
    if (currentEl) {
      currentEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [currentMatchIndex, searchText])

  if (!searchText) {
    return (
      <pre
        ref={containerRef}
        style={{
          padding: '12px',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '11px',
          whiteSpace: 'pre',
          color: '#a1a1aa',
          margin: 0,
          width: 'fit-content',
          minWidth: '100%',
        }}
      >
        {text}
      </pre>
    )
  }

  // Split text by search term and create highlighted spans
  const parts: React.ReactNode[] = []
  const lowerText = text.toLowerCase()
  const lowerSearch = searchText.toLowerCase()
  let lastIndex = 0
  let matchIndex = 0

  let pos = lowerText.indexOf(lowerSearch)
  while (pos !== -1) {
    if (pos > lastIndex) {
      parts.push(text.slice(lastIndex, pos))
    }
    const isCurrentMatch = matchIndex === currentMatchIndex
    parts.push(
      <span
        key={`match-${matchIndex}`}
        data-highlight-index={matchIndex}
        style={{
          background: isCurrentMatch ? '#f59e0b' : '#f59e0b40',
          color: isCurrentMatch ? '#000' : '#f59e0b',
          borderRadius: '2px',
          padding: '0 1px',
        }}
      >
        {text.slice(pos, pos + searchText.length)}
      </span>
    )
    matchIndex++
    lastIndex = pos + searchText.length
    pos = lowerText.indexOf(lowerSearch, lastIndex)
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return (
    <pre
      ref={containerRef}
      style={{
        padding: '12px',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '11px',
        whiteSpace: 'pre',
        color: '#a1a1aa',
        margin: 0,
        width: 'fit-content',
        minWidth: '100%',
      }}
    >
      {parts}
    </pre>
  )
}

export default function RawView({
  data,
  searchText = '',
  currentMatchIndex = 0,
  onMatchesFound,
}: RawViewProps) {
  // Try to pretty-print JSON
  const displayData = useMemo(() => {
    try {
      const parsed = JSON.parse(data)
      return JSON.stringify(parsed, null, 2)
    } catch {
      return data
    }
  }, [data])

  return (
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
      <HighlightedText
        text={displayData}
        searchText={searchText}
        currentMatchIndex={currentMatchIndex}
        onMatchesFound={onMatchesFound}
      />
    </OverlayScrollbarsComponent>
  )
}
