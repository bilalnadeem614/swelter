import { useEffect, useState } from "react"
import { ArrowLeft } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { ZoneMap } from "@/components/ZoneMap"
import { ComplianceAgent } from "@/components/ComplianceAgent"
import { DecisionAuditLog } from "@/components/DecisionAuditLog"
import {
  fetchZones,
  fetchLatestDecisions,
  forecastRangeF,
  tempTrend,
  type Zone,
  type Decision,
  type Action,
} from "@/lib/api"

const TREND_ARROW = { up: "↑", down: "↓", flat: "→" }

const ACTION_BADGE: Record<Action, "secondary" | "outline" | "destructive"> = {
  none: "outline",
  alert: "secondary",
  reschedule: "secondary",
  escalate: "destructive",
}

// General OSHA-aligned heat-safety guidance per action tier — same tiers gemini_reasoning.py
// prompts the model with. Static reference text, not a live protocol feed.
const PROTOCOLS: Record<Action, { title: string; body: string }[]> = {
  none: [
    { title: "Standard Hydration", body: "Water accessible, encourage regular breaks in shade when available." },
  ],
  alert: [
    { title: "Supervisor Check-in", body: "Advisory issued to check on crews. Increase hydration reminders." },
    { title: "Monitor Trend", body: "Watch forecast for continued rise; re-evaluate before next shift." },
  ],
  reschedule: [
    { title: "Reschedule Outdoor Work", body: "Move non-essential outdoor tasks to cooler hours where possible." },
    { title: "Mandatory Rest Cycles", body: "Increase rest-to-work ratio for any work that can't be moved." },
    { title: "Hydration Enforcement", body: "Active supervisor monitoring of water intake required." },
  ],
  escalate: [
    { title: "Notify Safety Manager", body: "Immediate notification per OSHA general duty clause obligations." },
    { title: "Mandatory Rest Cycles", body: "Enforce frequent, extended rest in shade or air-conditioned areas." },
    { title: "Hydration Enforcement", body: "Mandatory supervised water intake, minimum 1 quart/hour/worker." },
    { title: "No Solo Tasks", body: "Suspend solo outdoor assignments until conditions improve." },
  ],
}

export function ZoneDetail({ zoneId, onBack, refreshKey }: { zoneId: string; onBack: () => void; refreshKey?: number }) {
  const [zone, setZone] = useState<Zone | null>(null)
  const [decision, setDecision] = useState<Decision | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([fetchZones(), fetchLatestDecisions()])
      .then(([zones, decisions]) => {
        setZone(zones.find((z) => z.id === zoneId) ?? null)
        setDecision(decisions.find((d) => d.zone_id === zoneId) ?? null)
      })
      .catch((err) => setError(err.message))
  }, [zoneId, refreshKey])

  const action = decision?.action ?? "none"
  const forecast = forecastRangeF(decision?.reading?.forecast_12h ?? null)

  return (
    <div className="flex flex-col gap-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="w-fit gap-1.5">
        <ArrowLeft className="size-4" />
        Back to dashboard
      </Button>

      {error && <p className="text-sm text-destructive">Couldn't load zone — {error}</p>}
      {!error && !zone && <Skeleton className="h-32 w-full rounded-xl" />}

      {zone && (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="flex flex-col gap-4 lg:col-span-2">
              <ZoneMap zoneId={zoneId} onZoneClick={() => {}} refreshKey={refreshKey} />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Card className="sm:col-span-1">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between gap-2">
                      <span>{zone.name}</span>
                      <Badge variant={ACTION_BADGE[action]} className="capitalize">
                        {action}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {decision?.reading ? (
                      <>
                        <p className="text-4xl font-bold">
                          {Math.round(decision.reading.temperature_f)}
                          <span className="text-xl">°F</span>{" "}
                          <span
                            className="text-lg text-muted-foreground"
                            title="vs. previous reading for this zone"
                          >
                            {TREND_ARROW[tempTrend(decision.reading.temperature_f, decision.previous_temperature_f)]}
                          </span>
                        </p>
                        {forecast && <p className="mt-1 text-sm text-muted-foreground">Forecast next 12h: {forecast}</p>}
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">No reading yet.</p>
                    )}
                  </CardContent>
                </Card>

                <Card className="sm:col-span-2">
                  <CardHeader>
                    <CardTitle>Active Protocols · {action === "none" ? "Baseline" : action}</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {PROTOCOLS[action].map((p) => (
                      <div key={p.title} className="rounded-lg border bg-muted/30 p-3">
                        <p className="text-sm font-medium">{p.title}</p>
                        <p className="text-xs text-muted-foreground">{p.body}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </div>

            <ComplianceAgent zoneId={zoneId} />
          </div>

          <DecisionAuditLog zoneId={zoneId} refreshKey={refreshKey} />
        </>
      )}
    </div>
  )
}
