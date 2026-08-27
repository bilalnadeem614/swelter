import { useEffect, useState, type FormEvent } from "react"
import { Bot, User } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { askAgent, fetchDecisions, fetchZones, type Decision, type Action, type Zone } from "@/lib/api"

type QaEntry = { id: number; question: string; answer?: string; pending?: boolean; error?: string }

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

  async function handleAsk(e: FormEvent) {
    e.preventDefault()
    const q = question.trim()
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
        <CardTitle className="flex items-center justify-between">
          <span>Agent Activity</span>
          {zoneId && (
            <button
              onClick={onClearZone}
              className="text-xs font-normal text-muted-foreground hover:text-foreground hover:underline"
            >
              {zoneNames[zoneId] ?? "Filtered"} · Clear
            </button>
          )}
        </CardTitle>
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
                <Badge variant={style.badge} className="w-fit capitalize">
                  {d.action}
                </Badge>
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
      <CardFooter>
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
