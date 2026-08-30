import { Bell, Settings, Sun, Moon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

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
        <Button variant="ghost" size="icon" onClick={() => console.log('notifications: not implemented')}>
          <Bell />
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
