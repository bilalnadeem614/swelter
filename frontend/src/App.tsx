import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { ZoneMap } from '@/components/ZoneMap'
import { ZoneStatusCards } from '@/components/ZoneStatusCards'
import { ComplianceAgent } from '@/components/ComplianceAgent'
import { DecisionAuditLog } from '@/components/DecisionAuditLog'
import { ZoneDetail } from '@/components/ZoneDetail'
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
        <main className="mx-auto flex max-w-6xl flex-col gap-4 p-4 sm:p-6">
          {selectedZoneId ? (
            <ZoneDetail zoneId={selectedZoneId} onBack={() => setSelectedZoneId(undefined)} refreshKey={refreshKey} />
          ) : (
            <>
              <section className="flex flex-wrap items-center justify-between gap-3 py-2">
                <div>
                  <h1 className="font-heading text-2xl font-medium sm:text-3xl">Infrastructure Command</h1>
                  <p className="text-sm text-muted-foreground">
                    Autonomous AI heat risk monitoring — active watch zones below.
                  </p>
                </div>
                <div>
                  <Button onClick={handleCheckNow} disabled={checking} className="gap-1.5">
                    <RefreshCw className={checking ? 'animate-spin' : ''} />
                    {checking ? 'Checking… (can take up to a minute)' : 'Check Now'}
                  </Button>
                  {checkError && <p className="mt-2 text-sm text-destructive">{checkError}</p>}
                </div>
              </section>
              <ZoneStatusCards onSelectZone={setSelectedZoneId} refreshKey={refreshKey} />
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <ZoneMap onZoneClick={setSelectedZoneId} refreshKey={refreshKey} />
                </div>
                <ComplianceAgent />
              </div>
              <DecisionAuditLog refreshKey={refreshKey} />
            </>
          )}
        </main>
      )}
    </>
  )
}

export default App
