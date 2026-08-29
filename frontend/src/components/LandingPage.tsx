import { ArrowRight, Thermometer, Cpu, ShieldCheck, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

const WORKFLOW = [
  {
    n: '01',
    icon: Thermometer,
    title: 'Poll temperature data',
    body: 'Continuous integration with hyperlocal weather APIs — no on-site hardware to install or maintain.',
  },
  {
    n: '02',
    icon: Cpu,
    title: 'AI reasons about risk',
    body: 'An LLM evaluates current conditions plus the 12-hour forecast against the last 5 decisions for each zone before recommending an action.',
  },
  {
    n: '03',
    icon: ShieldCheck,
    title: 'Alerts + audit log',
    body: 'Every check, whether or not it triggers an action, is posted to the in-app decision feed with its reasoning — a defensible, timestamped audit trail.',
  },
]

const COMPARISON = [
  {
    feature: 'Deployment Model',
    swelter: 'Autonomous, hardware-free',
    static: 'Hardware-dependent',
    info: 'No automation',
  },
  {
    feature: 'Risk Assessment',
    swelter: 'AI-driven dynamic reasoning',
    static: 'Manual rulesets',
    info: 'Manual checking',
  },
  {
    feature: 'Compliance Record',
    swelter: 'Automated audit trail',
    static: 'Fragmented logs',
    info: 'Non-existent',
  },
]

export function LandingPage({ onViewDashboard }: { onViewDashboard: () => void }) {
  return (
    <div className="flex flex-col gap-16 px-4 pb-16 sm:px-6">
      <section
        className="relative -mx-4 overflow-hidden border-b border-border px-4 py-20 text-center sm:-mx-6 sm:px-6"
        style={{
          backgroundImage:
            'repeating-linear-gradient(45deg, color-mix(in oklch, var(--accent), transparent 94%) 0, color-mix(in oklch, var(--accent), transparent 94%) 1px, transparent 1px, transparent 32px)',
        }}
      >
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 font-mono text-[0.7rem] tracking-wide text-muted-foreground uppercase">
            <span className="size-1.5 rounded-full bg-accent" />
            System status: active monitoring
          </span>
          <h1 className="font-heading text-3xl font-bold sm:text-5xl">
            Autonomous AI Heat-Risk Monitoring.
            <br />
            <span className="text-muted-foreground">No Sensors. No Enterprise Contracts. Just Defensible Compliance.</span>
          </h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Automating heat risk audits for safety managers and owner-operators at small to
            mid-sized construction and landscaping contractors. OSHA can issue heat-related
            citations today under the General Duty Clause, even without a finalized federal heat
            standard — enforcement was reinforced via a revised National Emphasis Program in 2026.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button onClick={onViewDashboard} className="gap-1.5">
              View live dashboard
              <ArrowRight />
            </Button>
            <Button
              variant="outline"
              onClick={() => window.open('https://github.com/bilalnadeem614/swelter', '_blank', 'noopener')}
            >
              Documentation
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <div className="border-l-2 border-accent pl-3">
          <h2 className="font-heading text-xl font-semibold sm:text-2xl">Operational Workflow</h2>
          <p className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
            3-stage autonomous audit
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {WORKFLOW.map(({ n, icon: Icon, title, body }) => (
            <div key={n} className="relative rounded-lg border border-border bg-card p-4">
              <span className="absolute top-3 right-3 font-mono text-xs text-muted-foreground">{n}</span>
              <div className="mb-3 flex size-9 items-center justify-center rounded-md border border-border bg-muted">
                <Icon className="size-4 text-accent" />
              </div>
              <h3 className="font-heading font-medium">{title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <div className="border-l-2 border-accent pl-3">
          <h2 className="font-heading text-xl font-semibold sm:text-2xl">System Architecture Comparison</h2>
          <p className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
            Evaluating market solutions
          </p>
        </div>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted font-mono text-xs tracking-wide text-muted-foreground uppercase">
                <th className="px-4 py-2.5 font-medium">Feature Vector</th>
                <th className="px-4 py-2.5 font-medium text-accent">Swelter (Target)</th>
                <th className="px-4 py-2.5 font-medium">Static Tools</th>
                <th className="px-4 py-2.5 font-medium">Info Tools</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((row) => (
                <tr key={row.feature} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">{row.feature}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-foreground">
                      <Check className="size-3.5 text-accent" />
                      {row.swelter}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{row.static}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.info}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="mx-auto flex w-full max-w-4xl flex-col gap-4 border-t border-border pt-6 text-sm sm:flex-row sm:items-center sm:justify-between">
        <span className="font-heading font-bold">SWELTER</span>
        <nav className="flex flex-wrap gap-4 text-muted-foreground">
          <a href="#" className="underline-offset-4 hover:underline">Documentation</a>
          <a href="#" className="underline-offset-4 hover:underline">Safety Protocols</a>
          <a href="#" className="underline-offset-4 hover:underline">System Status</a>
          <a href="#" className="underline-offset-4 hover:underline">Privacy</a>
        </nav>
        <span className="text-muted-foreground">© 2026 Swelter. All rights reserved.</span>
      </footer>
    </div>
  )
}
