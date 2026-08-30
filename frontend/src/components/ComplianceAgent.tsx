import { useState, type FormEvent } from "react"
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { askAgent } from "@/lib/api"
import { cn } from "@/lib/utils"
import { Sparkles } from "lucide-react"

type QaEntry = { id: number; question: string; answer?: string; pending?: boolean; error?: string }

const DASHBOARD_QUESTIONS = ["What's my riskiest zone right now?", "Any zones needing action today?"]
const ZONE_QUESTIONS = ["What's the current risk here?", "What protocol applies right now?"]

// ponytail: reuses the same /api/chat endpoint as the dashboard's zone-level assistant —
// no separate "compliance" backend, this is a styling/framing difference only.
// zoneId (passed from the zone detail page) scopes the agent to that one site's data only —
// on the main dashboard it's omitted, so the agent sees every zone.
export function ComplianceAgent({ zoneId, className }: { zoneId?: string; className?: string }) {
  const [qaLog, setQaLog] = useState<QaEntry[]>([])
  const [question, setQuestion] = useState("")
  const suggestedQuestions = zoneId ? ZONE_QUESTIONS : DASHBOARD_QUESTIONS

  async function handleAsk(e?: FormEvent, override?: string) {
    e?.preventDefault()
    const q = (override ?? question).trim()
    if (!q) return
    setQuestion("")
    const id = Date.now()
    setQaLog((log) => [...log, { id, question: q, pending: true }])
    try {
      const answer = await askAgent(q, zoneId)
      setQaLog((log) => log.map((entry) => (entry.id === id ? { ...entry, answer, pending: false } : entry)))
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to reach the agent"
      setQaLog((log) => log.map((entry) => (entry.id === id ? { ...entry, error: message, pending: false } : entry)))
    }
  }

  return (
    <Card className={cn("flex h-full flex-col", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-accent/15 text-accent">
            <Sparkles className="size-3.5" />
          </span>
          AI Compliance Agent
        </CardTitle>
        <p className="text-xs text-muted-foreground">Grounded in live zone readings + decision history</p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3 overflow-y-auto">
        {qaLog.length === 0 && (
          <p className="text-sm text-muted-foreground">Ask about current conditions, risk, or recommended action.</p>
        )}
        {qaLog.map((entry) => (
          <div key={entry.id} className="flex flex-col gap-2">
            <p className="rounded-lg bg-muted px-3 py-2 text-sm">{entry.question}</p>
            {entry.pending && <Skeleton className="h-8 w-2/3 rounded-lg" />}
            {entry.error && <p className="text-sm text-destructive">{entry.error}</p>}
            {entry.answer && <p className="rounded-lg border bg-card px-3 py-2 text-sm">{entry.answer}</p>}
          </div>
        ))}
      </CardContent>
      <CardFooter className="flex flex-col items-stretch gap-2">
        {qaLog.length === 0 && (
          <div className="flex flex-wrap gap-1.5">
            {suggestedQuestions.map((q) => (
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
            placeholder="Query compliance agent..."
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
