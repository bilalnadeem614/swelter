import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { fetchZones, fetchLatestDecisions, type Zone, type Decision, type Action } from "@/lib/api"
import { useEffect, useState } from "react"
import { CheckCircle2, AlertTriangle, Clock, Flame, type LucideIcon } from "lucide-react"

const ACTION_BORDER: Record<Action, string> = {
  none: "border-l-chart-1",
  alert: "border-l-yellow-500",
  reschedule: "border-l-orange-500",
  escalate: "border-l-destructive",
}

const ACTION_BADGE: Record<Action, "secondary" | "outline" | "destructive"> = {
  none: "outline",
  alert: "secondary",
  reschedule: "secondary",
  escalate: "destructive",
}

const ACTION_LABEL: Record<Action, string> = {
  none: "Nominal",
  alert: "Alert",
  reschedule: "Reschedule",
  escalate: "Escalate",
}

const ACTION_ICON: Record<Action, LucideIcon> = {
  none: CheckCircle2,
  alert: AlertTriangle,
  reschedule: Clock,
  escalate: Flame,
}

const ACTION_ICON_STYLE: Record<Action, string> = {
  none: "bg-chart-1/15 text-chart-1",
  alert: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400",
  reschedule: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  escalate: "bg-destructive/15 text-destructive",
}

export function ZoneStatusCards({
  onSelectZone,
  refreshKey,
}: {
  onSelectZone: (zoneId: string) => void
  refreshKey?: number
}) {
  const [zones, setZones] = useState<Zone[] | null>(null)
  const [latestByZone, setLatestByZone] = useState<Record<string, Decision>>({})

  useEffect(() => {
    Promise.all([fetchZones(), fetchLatestDecisions()]).then(([zoneRows, decisionRows]) => {
      setZones(zoneRows)
      setLatestByZone(Object.fromEntries(decisionRows.map((d) => [d.zone_id, d])))
    })
  }, [refreshKey])

  if (!zones) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-32 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {zones.map((zone, i) => {
        const decision = latestByZone[zone.id]
        const action = decision?.action ?? "none"
        const Icon = ACTION_ICON[action]
        return (
          <button key={zone.id} onClick={() => onSelectZone(zone.id)} className="text-left">
            <Card
              className={`h-full rounded-2xl border-l-4 ${ACTION_BORDER[action]} transition-all duration-200 hover:-translate-y-1 hover:shadow-lg`}
            >
              <div className="flex items-start justify-between gap-2 px-4">
                <div className="flex items-center gap-2">
                  <span className={`flex size-8 items-center justify-center rounded-full ${ACTION_ICON_STYLE[action]}`}>
                    <Icon className="size-4" />
                  </span>
                  <span className="text-xs tracking-wide text-muted-foreground">
                    ZONE {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <Badge variant={ACTION_BADGE[action]}>{ACTION_LABEL[action]}</Badge>
              </div>
              <div className="px-4">
                <h3 className="font-heading text-lg font-medium">{zone.name}</h3>
                {decision?.reading ? (
                  <p className="mt-1 text-4xl font-bold tabular-nums">
                    {Math.round(decision.reading.temperature_f)}
                    <span className="text-xl text-muted-foreground">°F</span>
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">No reading yet.</p>
                )}
              </div>
            </Card>
          </button>
        )
      })}
    </div>
  )
}
