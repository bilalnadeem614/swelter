import { ArrowRight, Radar, Cpu, ShieldCheck, ClipboardCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'

const HOW_IT_WORKS = [
  {
    n: '01',
    icon: Radar,
    title: 'Scheduled polling',
    body: 'GitHub Actions triggers /api/check-heat roughly every 30 minutes, which pulls current temperature and the 12-hour forecast from FortyGuard for each active watch zone.',
  },
  {
    n: '02',
    icon: Cpu,
    title: 'AI reasoning',
    body: "Gemini evaluates the current reading, the forecast range, and the zone's last 5 decisions, and returns a structured action (none / alert / reschedule / escalate) with plain-language reasoning. This is dynamic reasoning over recent history, not a static threshold check.",
  },
  {
    n: '03',
    icon: ShieldCheck,
    title: 'Logging + audit trail',
    body: 'Every check is written to the database and posted to the Agent Activity feed, whether or not it triggers an action, creating a timestamped, defensible compliance record.',
  },
  {
    n: '04',
    icon: ClipboardCheck,
    title: 'Field confirmation',
    body: 'When the agent recommends action, a safety manager can mark it "Field confirmed" once the recommendation is actually carried out on site. This is a separate human record layered on top of the AI\'s own decision, not an approval gate the AI waits on — the agent has already acted autonomously by the time this step happens.',
  },
]

const USAGE_STEPS = [
  'Check zone status at a glance via the color-coded map markers and the summary row (Nominal / Alert / Reschedule / Escalate counts).',
  'Click a zone marker to filter the Agent Activity feed to that zone; click "Clear" to see all zones again.',
  'Use "Check Now" to trigger an immediate check outside the normal ~30-minute schedule.',
  'Ask the agent a question directly in the chat box (mention the suggested-question chips), or type your own.',
  'Mark a decision "Field confirmed" once you\'ve acted on it.',
  'Download a PDF audit log of all decisions (or a filtered zone\'s decisions) via the Download PDF button — includes each decision\'s field-confirmation status and a summary count.',
]

export function DocsPage({ onViewDashboard }: { onViewDashboard: () => void }) {
  return (
    <div className="flex flex-col gap-16 px-4 pb-16 sm:px-6">
      <section className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4 pt-24 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 font-mono text-[0.7rem] tracking-wide text-muted-foreground uppercase">
          <span className="size-1.5 rounded-full bg-accent" />
          Documentation
        </span>
        <h1 className="font-heading text-3xl font-bold sm:text-4xl">
          How Swelter works
        </h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          What the agent does behind the scenes, and how to use the dashboard
          day to day.
        </p>
      </section>

      <section className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <div className="border-l-2 border-accent pl-3">
          <h2 className="font-heading text-xl font-semibold sm:text-2xl">
            How It Works
          </h2>
          <p className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
            4-stage autonomous loop
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {HOW_IT_WORKS.map(({ n, icon: Icon, title, body }) => (
            <div
              key={n}
              className="relative rounded-lg border border-border bg-card p-4"
            >
              <span className="absolute top-3 right-3 font-mono text-xs text-muted-foreground">
                {n}
              </span>
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
          <h2 className="font-heading text-xl font-semibold sm:text-2xl">
            How To Use The Dashboard
          </h2>
          <p className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
            Day-to-day workflow
          </p>
        </div>
        <ol className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
          {USAGE_STEPS.map((step, i) => (
            <li key={i} className="flex items-start gap-3 text-sm">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-border font-mono text-xs text-muted-foreground">
                {i + 1}
              </span>
              <span className="text-muted-foreground">{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <div className="border-l-2 border-accent pl-3">
          <h2 className="font-heading text-xl font-semibold sm:text-2xl">
            A Note On Data Freshness
          </h2>
          <p className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
            Honest disclosure
          </p>
        </div>
        <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          Readings are the latest available from FortyGuard's hyperlocal API,
          which has an ingestion lag of roughly 48 hours; this is disclosed in
          the app (see the label under each zone's reading) and in the PDF
          export rather than presented as real-time.
        </p>
      </section>

      <section className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4 text-center">
        <Button onClick={onViewDashboard} className="gap-1.5">
          View live dashboard
          <ArrowRight />
        </Button>
      </section>
    </div>
  );
}
