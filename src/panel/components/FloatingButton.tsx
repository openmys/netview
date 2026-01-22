interface FloatingButtonProps {
  onClick: () => void
  requestCount: number
  isOpen: boolean
}

export default function FloatingButton({ onClick, requestCount, isOpen }: FloatingButtonProps) {
  return (
    <button
      onClick={onClick}
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        width: '56px',
        height: '56px',
        borderRadius: '50%',
        background: isOpen ? '#6366f1' : '#18181b',
        border: '2px solid #27272a',
        color: '#fff',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
        transition: 'all 0.2s ease',
        zIndex: 2147483647,
      }}
      title={isOpen ? 'Close NetView' : 'Open NetView'}
    >
      <div style={{ position: 'relative' }}>
        {/* Network icon */}
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="2" />
          <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14" />
        </svg>

        {/* Request count badge */}
        {requestCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '-8px',
              right: '-8px',
              background: '#ef4444',
              color: '#fff',
              fontSize: '10px',
              fontWeight: '600',
              padding: '2px 5px',
              borderRadius: '10px',
              minWidth: '18px',
              textAlign: 'center',
            }}
          >
            {requestCount > 99 ? '99+' : requestCount}
          </span>
        )}
      </div>
    </button>
  )
}
