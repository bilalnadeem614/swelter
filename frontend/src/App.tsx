import { useState } from 'react'
import { ZoneMap } from '@/components/ZoneMap'
import { ChatFeed } from '@/components/ChatFeed'

function App() {
  const [selectedZoneId, setSelectedZoneId] = useState<string | undefined>(undefined)

  return (
    <main className="mx-auto max-w-3xl p-6 flex flex-col gap-6">
      <h1 className="text-xl font-heading font-medium">Swelter</h1>
      <ZoneMap onZoneClick={setSelectedZoneId} />
      <ChatFeed zoneId={selectedZoneId} onClearZone={() => setSelectedZoneId(undefined)} />
    </main>
  )
}

export default App
