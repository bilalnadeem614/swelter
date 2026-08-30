import { useEffect, useState } from 'react'
import { Bell, BellRing, Settings, Sun, Moon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { enablePush, getExistingSubscription, isPushSupported } from '@/lib/push'

type View = 'landing' | 'dashboard' | 'docs'
type Theme = 'light' | 'dark'

export function NavBar({
  view,
  onNavigate,
  theme,
  onToggleTheme,
}: {
  view: View
  onNavigate: (v: View) => void
  theme: Theme
  onToggleTheme: () => void
}) {
  const [pushState, setPushState] = useState<'unsubscribed' | 'subscribing' | 'subscribed' | 'unsupported'>(
    'unsubscribed'
  )

  useEffect(() => {
    if (!isPushSupported()) {
      setPushState('unsupported')
      return
    }
    getExistingSubscription().then((sub) => setPushState(sub ? 'subscribed' : 'unsubscribed'))
  }, [])

  async function handleEnablePush() {
    if (pushState === 'subscribed' || pushState === 'subscribing' || pushState === 'unsupported') return
    setPushState('subscribing')
    try {
      await enablePush()
      setPushState('subscribed')
    } catch (err) {
      console.warn('push subscribe failed:', err instanceof Error ? err.message : err)
      setPushState('unsubscribed')
    }
  }
  return (
    <header className="sticky top-0 z-10 flex items-center gap-6 border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur-md supports-backdrop-filter:bg-background/60 sm:px-6">
      <span className="font-heading text-lg font-bold tracking-tight">SWELTER</span>
      <nav className="flex items-center gap-5 text-sm">
        <button
          onClick={() => onNavigate('landing')}
          className={cn(
            'underline-offset-4',
            view === 'landing' ? 'text-foreground underline' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Landing
        </button>
        <button
          onClick={() => onNavigate('dashboard')}
          className={cn(
            'underline-offset-4',
            view === 'dashboard' ? 'text-foreground underline' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Dashboard
        </button>
        <button
          onClick={() => onNavigate('docs')}
          className={cn(
            'underline-offset-4',
            view === 'docs' ? 'text-foreground underline' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Documentation
        </button>
      </nav>
      <div className="ml-auto flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleEnablePush}
          disabled={pushState === 'unsupported' || pushState === 'subscribing'}
          title={
            pushState === 'unsupported'
              ? 'Push notifications not supported in this browser'
              : pushState === 'subscribed'
                ? 'Push alerts enabled'
                : 'Enable push alerts for heat risk actions'
          }
          aria-label="Toggle push notifications"
        >
          {pushState === 'subscribed' ? <BellRing className="text-accent" /> : <Bell />}
        </Button>
        <Button variant="ghost" size="icon" onClick={() => console.log('settings: not implemented')}>
          <Settings />
        </Button>
        <Button variant="ghost" size="icon" onClick={onToggleTheme} aria-label="Toggle theme">
          {theme === 'dark' ? <Sun /> : <Moon />}
        </Button>
      </div>
    </header>
  )
}
