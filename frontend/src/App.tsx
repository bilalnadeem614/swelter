import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { ZoneMap } from '@/components/ZoneMap'
import { ChatFeed } from '@/components/ChatFeed'
import { NavBar } from '@/components/NavBar'
import { LandingPage } from '@/components/LandingPage'
import { DocsPage } from '@/components/DocsPage'
import { Button } from '@/components/ui/button'
import { triggerCheckNow } from '@/lib/api'

function App() {
  const [view, setView] = useState<'landing' | 'dashboard' | 'docs'>('landing')
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'dark'
    return (localStorage.getItem('swelter-theme') as 'light' | 'dark') ?? 'dark'
  })
  const [selectedZoneId, setSelectedZoneId] = useState<string | undefined>(undefined)
  const [refreshKey, setRefreshKey] = useState(0)
  const [checking, setChecking] = useState(false)
  const [checkError, setCheckError] = useState<string | null>(null)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('swelter-theme', theme)
  }, [theme])

  async function handleCheckNow() {
    setChecking(true)
    setCheckError(null)
    try {
      await triggerCheckNow()
      setRefreshKey((k) => k + 1)
    } catch (err) {
      setCheckError(err instanceof Error ? err.message : 'check failed')
    } finally {
      setChecking(false)
    }
  }

  return (
    <>
      <NavBar view={view} onNavigate={setView} theme={theme} onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))} />
      {view === 'landing' ? (
        <LandingPage onViewDashboard={() => setView('dashboard')} onViewDocs={() => setView('docs')} />
      ) : view === 'docs' ? (
        <DocsPage onViewDashboard={() => setView('dashboard')} />
      ) : (
        <main className="mx-auto flex max-w-3xl flex-col gap-6 p-4 sm:p-6">
          <section className="flex flex-col gap-3 py-4 sm:py-6">
            <h1 className="text-2xl font-heading font-medium sm:text-3xl">Swelter</h1>
            <p className="text-base text-muted-foreground sm:text-lg">
              Autonomous AI heat risk monitoring for small construction and landscaping crews.
            </p>
            <p className="text-sm text-muted-foreground">
              Small contractors lack an affordable, automated way to track heat risk and keep OSHA
              compliance records — safety managers and owner-operators in high-heat states (AZ, TX, FL)
              are stuck doing it manually, or not at all. Enterprise crews already have hardware-based
              alert systems; Swelter is the first hardware-free, AI-reasoning agent that watches hyperlocal
              conditions, decides when action is needed, and logs every decision for an audit trail —
              enterprise-grade protection at a small contractor's price point.
            </p>
            <div>
              <Button onClick={handleCheckNow} disabled={checking} className="gap-1.5">
                <RefreshCw className={checking ? 'animate-spin' : ''} />
                {checking ? 'Checking… (can take up to a minute)' : 'Check Now'}
              </Button>
              {checkError && <p className="mt-2 text-sm text-destructive">{checkError}</p>}
            </div>
          </section>
          <ZoneMap onZoneClick={setSelectedZoneId} refreshKey={refreshKey} />
          <ChatFeed zoneId={selectedZoneId} onClearZone={() => setSelectedZoneId(undefined)} refreshKey={refreshKey} />
        </main>
      )}
    </>
  )
}

export default App
