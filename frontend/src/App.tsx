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
import { triggerCheckNow, fetchZones } from '@/lib/api'

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
  const [checkProgress, setCheckProgress] = useState<{ done: number; total: number } | null>(null)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('swelter-theme', theme)
  }, [theme])

  // Checks one zone at a time (was one request for all zones) — each zone now gets the
  // backend's full per-request time budget to itself instead of sharing it with the others,
  // which is what caused only some of 3 zones to complete some runs. See decisions.md
  // 2026-08-30. Errors on one zone don't stop the rest; failures are collected and shown
  // together at the end.
  async function handleCheckNow() {
    setChecking(true)
    setCheckError(null)
    try {
      const zones = await fetchZones()
      setCheckProgress({ done: 0, total: zones.length })
      const errors: string[] = []
      for (const [i, zone] of zones.entries()) {
        try {
          await triggerCheckNow(zone.id)
        } catch (err) {
          errors.push(`${zone.name}: ${err instanceof Error ? err.message : 'failed'}`)
        }
        setCheckProgress({ done: i + 1, total: zones.length })
        setRefreshKey((k) => k + 1)
      }
      if (errors.length > 0) setCheckError(errors.join(' · '))
    } catch (err) {
      setCheckError(err instanceof Error ? err.message : 'check failed')
    } finally {
      setChecking(false)
      setCheckProgress(null)
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
              <section className="relative flex flex-wrap items-center justify-between gap-3 overflow-hidden rounded-2xl border border-border/60 bg-card px-5 py-5 shadow-sm sm:px-6">
                <div
                  aria-hidden
                  className="pointer-events-none absolute -top-24 -right-24 size-64 rounded-full bg-accent/20 blur-3xl"
                />
                <div className="relative">
                  <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
                    Infrastructure Command
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Autonomous AI heat risk monitoring — active watch zones below.
                  </p>
                </div>
                <div className="relative">
                  <Button onClick={handleCheckNow} disabled={checking} className="gap-1.5">
                    <RefreshCw className={checking ? 'animate-spin' : ''} />
                    {checking
                      ? checkProgress
                        ? `Checking zone ${checkProgress.done}/${checkProgress.total}…`
                        : 'Checking…'
                      : 'Check Now'}
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
