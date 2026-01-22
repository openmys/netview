import { atom } from 'jotai'
import type { NetworkRequest, PanelState } from '../../shared/types'

// Constants
const PANEL_WIDTH_KEY = 'netview-panel-width'
const DEFAULT_PANEL_WIDTH = 450
export const MIN_PANEL_WIDTH = 320
export const MAX_PANEL_WIDTH = 800

// Load saved panel width from localStorage
const getSavedPanelWidth = (): number => {
  try {
    const saved = localStorage.getItem(PANEL_WIDTH_KEY)
    if (saved) {
      const width = parseInt(saved, 10)
      if (!isNaN(width) && width >= MIN_PANEL_WIDTH && width <= MAX_PANEL_WIDTH) {
        return width
      }
    }
  } catch {
    // localStorage not available
  }
  return DEFAULT_PANEL_WIDTH
}

// All captured requests
export const requestsAtom = atom<NetworkRequest[]>([])

// Filter string
export const filterAtom = atom<string>('')

// Panel width (persisted to localStorage)
export const panelWidthAtom = atom(getSavedPanelWidth())

// Action to set panel width with persistence
export const setPanelWidthAtom = atom(
  null,
  (_get, set, width: number) => {
    const clampedWidth = Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, width))
    set(panelWidthAtom, clampedWidth)
    try {
      localStorage.setItem(PANEL_WIDTH_KEY, clampedWidth.toString())
    } catch {
      // localStorage not available
    }
  }
)

// Detail view state: view specific request in detail mode with search
export interface DetailViewState {
  requestId: string | null  // Target request ID for detail view
  searchText: string        // Search text for highlighting
  currentMatchIndex: number // Current highlighted match index (0-based)
  totalMatches: number      // Total number of matches found
}

export const detailViewAtom = atom<DetailViewState>({
  requestId: null,
  searchText: '',
  currentMatchIndex: 0,
  totalMatches: 0,
})

// Derived: filtered requests
export const filteredRequestsAtom = atom((get) => {
  const requests = get(requestsAtom)
  const filter = get(filterAtom).toLowerCase()

  if (!filter) return requests

  return requests.filter(
    (req) =>
      req.url.toLowerCase().includes(filter) ||
      req.method.toLowerCase().includes(filter) ||
      (req.status?.toString() || '').includes(filter)
  )
})

// Panel UI state
export const panelStateAtom = atom<PanelState>({
  isOpen: false,
  isMinimized: false,
  position: { x: 0, y: 0 },
  size: { width: 400, height: 500 },
})

// Actions
export const addRequestAtom = atom(
  null,
  (get, set, request: NetworkRequest) => {
    const requests = get(requestsAtom)
    set(requestsAtom, [...requests, request])
  }
)

export const updateRequestAtom = atom(
  null,
  (get, set, update: Partial<NetworkRequest> & { id: string }) => {
    const requests = get(requestsAtom)
    set(
      requestsAtom,
      requests.map((req) =>
        req.id === update.id ? { ...req, ...update } : req
      )
    )
  }
)

export const clearRequestsAtom = atom(null, (_get, set) => {
  set(requestsAtom, [])
})

export const togglePanelAtom = atom(null, (get, set) => {
  const state = get(panelStateAtom)
  set(panelStateAtom, { ...state, isOpen: !state.isOpen })
})

export const minimizePanelAtom = atom(null, (get, set) => {
  const state = get(panelStateAtom)
  set(panelStateAtom, { ...state, isMinimized: !state.isMinimized })
})
