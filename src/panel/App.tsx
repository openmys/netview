import { useAtom, useAtomValue } from 'jotai'
import { panelStateAtom, filteredRequestsAtom, togglePanelAtom } from './stores/atoms'
import FloatingButton from './components/FloatingButton'
import Panel from './components/Panel'

export default function App() {
  const panelState = useAtomValue(panelStateAtom)
  const requests = useAtomValue(filteredRequestsAtom)
  const [, togglePanel] = useAtom(togglePanelAtom)

  return (
    <>
      <FloatingButton
        onClick={togglePanel}
        requestCount={requests.length}
        isOpen={panelState.isOpen}
      />
      {panelState.isOpen && <Panel />}
    </>
  )
}
