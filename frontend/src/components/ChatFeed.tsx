import { useEffect, useState } from "react"
import { Bot } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { fetchDecisions, fetchZones, type Decision, type Action, type Zone } from "@/lib/api"

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
        {error && <p className="text-sm text-destructive">{error}</p>}
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
      </CardContent>
    </Card>
  )
}
