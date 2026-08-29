import { useEffect, useState, type FormEvent } from "react"
import { Bot, Download, User } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { askAgent, confirmDecision, fetchDecisions, fetchZones, type Decision, type Action, type Zone } from "@/lib/api"
import { exportDecisionLogPdf } from "@/lib/exportPdf"

type QaEntry = { id: number; question: string; answer?: string; pending?: boolean; error?: string }

const SUGGESTED_QUESTIONS = [
  "What's my riskiest zone right now?",
  "Any zones needing action today?",
  "Summarize the last hour of activity",
]

const ACTION_STYLE: Record<Action, { badge: "secondary" | "outline" | "destructive"; border: string }> = {
  none: { badge: "outline", border: "border-l-transparent" },
  alert: { badge: "secondary", border: "border-l-yellow-500" },
  reschedule: { badge: "secondary", border: "border-l-orange-500" },
  escalate: { badge: "destructive", border: "border-l-red-500" },
}

export function ChatFeed({
  zoneId,
  onClearZone,
  refreshKey,
}: {
  zoneId?: string
  onClearZone?: () => void
  refreshKey?: number
}) {
  const [decisions, setDecisions] = useState<Decision[] | null>(null)
  const [zoneNames, setZoneNames] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [qaLog, setQaLog] = useState<QaEntry[]>([])
  const [question, setQuestion] = useState("")

  async function handleConfirm(decisionId: string) {
    const prev = decisions
    const optimisticIso = new Date().toISOString()
    setDecisions((rows) =>
      rows?.map((d) => (d.id === decisionId ? { ...d, field_confirmed_at: optimisticIso } : d)) ?? rows
    )
    try {
      const { field_confirmed_at } = await confirmDecision(decisionId)
      setDecisions((rows) =>
        rows?.map((d) => (d.id === decisionId ? { ...d, field_confirmed_at } : d)) ?? rows
      )
    } catch {
      setDecisions(prev)
    }
  }

  async function handleAsk(e?: FormEvent, override?: string) {
    e?.preventDefault()
    const q = (override ?? question).trim()
    if (!q) return
    setQuestion("")
    const id = Date.now()
    setQaLog((log) => [...log, { id, question: q, pending: true }])
    try {
      const answer = await askAgent(q)
      setQaLog((log) => log.map((entry) => (entry.id === id ? { ...entry, answer, pending: false } : entry)))
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to reach the agent"
      setQaLog((log) => log.map((entry) => (entry.id === id ? { ...entry, error: message, pending: false } : entry)))
    }
  }

  useEffect(() => {
    setDecisions(null)
    Promise.all([fetchDecisions(zoneId), fetchZones()])
      .then(([decisionRows, zoneRows]: [Decision[], Zone[]]) => {
        setDecisions(decisionRows)
        setZoneNames(Object.fromEntries(zoneRows.map((z) => [z.id, z.name])))
      })
      .catch((err) => setError(err.message))
  }, [zoneId, refreshKey])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span>Agent Activity</span>
          <div className="flex items-center gap-3">
            {zoneId && (
              <button
                onClick={onClearZone}
                className="text-xs font-normal text-muted-foreground hover:text-foreground hover:underline"
              >
                {zoneNames[zoneId] ?? "Filtered"} · Clear
              </button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={!decisions || decisions.length === 0}
              title={!decisions || decisions.length === 0 ? "No decisions to export" : undefined}
              onClick={() => decisions && exportDecisionLogPdf(decisions, zoneNames)}
            >
              <Download className="size-3.5" />
              Download PDF
            </Button>
          </div>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Considered: current reading + 12h forecast + last 5 decisions for this zone
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {error && (
          <p className="text-sm text-destructive">Couldn't load activity — {error}</p>
        )}
        {!error && !decisions && (
          <>
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
          </>
        )}
        {decisions?.length === 0 && (
          <p className="text-sm text-muted-foreground">No decisions yet.</p>
        )}
        {decisions?.map((d) => {
          const style = ACTION_STYLE[d.action]
          return (
            <div
              key={d.id}
              className={cn("flex gap-3 rounded-lg border-l-4 bg-muted/30 p-3", style.border)}
            >
              <Avatar>
                <AvatarFallback>
                  <Bot className="size-4" />
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-1 flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">
                    {zoneNames[d.zone_id] ?? "Unknown zone"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(d.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm">{d.reasoning}</p>
                <div className="flex items-center gap-2">
                  <Badge variant={style.badge} className="w-fit capitalize">
                    {d.action}
                  </Badge>
                  {d.action !== "none" && (
                    <button
                      onClick={() => !d.field_confirmed_at && handleConfirm(d.id)}
                      disabled={!!d.field_confirmed_at}
                      className={cn(
                        "text-xs rounded border px-1.5 py-0.5",
                        d.field_confirmed_at
                          ? "border-green-600 text-green-700 dark:text-green-500 cursor-default"
                          : "border-muted-foreground/40 text-muted-foreground hover:border-foreground hover:text-foreground"
                      )}
                      title="Human record that this action was physically carried out — separate from the AI's own decision"
                    >
                      {d.field_confirmed_at
                        ? `✓ Field confirmed at ${new Date(d.field_confirmed_at).toLocaleString()}`
                        : "☐ Field confirmed"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
        {qaLog.map((entry) => (
          <div key={entry.id} className="flex flex-col gap-2">
            <div className="flex items-start justify-end gap-3">
              <p className="max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">
                {entry.question}
              </p>
              <Avatar>
                <AvatarFallback>
                  <User className="size-4" />
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="flex items-start gap-3">
              <Avatar>
                <AvatarFallback>
                  <Bot className="size-4" />
                </AvatarFallback>
              </Avatar>
              {entry.pending && <Skeleton className="h-8 w-2/3 rounded-lg" />}
              {entry.error && <p className="max-w-[85%] text-sm text-destructive">{entry.error}</p>}
              {entry.answer && (
                <p className="max-w-[85%] rounded-lg border bg-card px-3 py-2 text-sm">{entry.answer}</p>
              )}
            </div>
          </div>
        ))}
      </CardContent>
      <CardFooter className="flex flex-col items-stretch gap-2">
        {qaLog.length === 0 && (
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => handleAsk(undefined, q)}
                className="rounded-full border border-input px-2.5 py-1 text-xs text-muted-foreground hover:border-foreground hover:text-foreground"
              >
                {q}
              </button>
            ))}
          </div>
        )}
        <form onSubmit={handleAsk} className="flex w-full gap-2">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask the agent, e.g. what's my riskiest zone right now?"
            className="h-8 flex-1 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <Button type="submit" size="sm" disabled={!question.trim()}>
            Ask
          </Button>
        </form>
      </CardFooter>
    </Card>
  )
}
