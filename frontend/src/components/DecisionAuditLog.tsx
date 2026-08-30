import { useEffect, useState } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { DecisionDetailModal } from "@/components/DecisionDetailModal"
import { fetchZones, fetchDecisions, confirmDecision, type Decision, type Action, type Zone } from "@/lib/api"
import { exportDecisionLogPdf } from "@/lib/exportPdf"

const ACTION_BADGE: Record<Action, "secondary" | "outline" | "destructive"> = {
  none: "outline",
  alert: "secondary",
  reschedule: "secondary",
  escalate: "destructive",
}

const PAGE_SIZE = 10

export function DecisionAuditLog({ zoneId, refreshKey }: { zoneId?: string; refreshKey?: number }) {
  const [decisions, setDecisions] = useState<Decision[] | null>(null)
  const [zoneNames, setZoneNames] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [visible, setVisible] = useState(PAGE_SIZE)
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    setVisible(PAGE_SIZE)
    Promise.all([fetchDecisions(zoneId), fetchZones()])
      .then(([decisionRows, zoneRows]: [Decision[], Zone[]]) => {
        setDecisions(decisionRows)
        setZoneNames(Object.fromEntries(zoneRows.map((z) => [z.id, z.name])))
      })
      .catch((err) => setError(err.message))
  }, [zoneId, refreshKey])

  async function handleConfirm(decisionId: string) {
    const prev = decisions
    const optimisticIso = new Date().toISOString()
    setDecisions((rows) => rows?.map((d) => (d.id === decisionId ? { ...d, field_confirmed_at: optimisticIso } : d)) ?? rows)
    try {
      const { field_confirmed_at } = await confirmDecision(decisionId)
      setDecisions((rows) => rows?.map((d) => (d.id === decisionId ? { ...d, field_confirmed_at } : d)) ?? rows)
    } catch {
      setDecisions(prev)
    }
  }

  const openDecision = decisions?.find((d) => d.id === openId) ?? null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span>Decision Audit Log</span>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={!decisions || decisions.length === 0}
            onClick={() => decisions && exportDecisionLogPdf(decisions, zoneNames)}
          >
            Export Log
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {error && <p className="text-sm text-destructive">Couldn't load audit log — {error}</p>}
        {!error && !decisions && <Skeleton className="h-64 w-full rounded-lg" />}
        {decisions?.length === 0 && <p className="text-sm text-muted-foreground">No decisions logged yet.</p>}
        {decisions && decisions.length > 0 && (
          <div className="max-h-[420px] overflow-y-auto rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="py-2 pr-4 pl-3 font-medium">Timestamp (local)</th>
                  {!zoneId && <th className="py-2 pr-4 font-medium">Zone</th>}
                  <th className="py-2 pr-4 font-medium">Recommended action by agent</th>
                  <th className="py-2 pr-4 font-medium">Reason</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {decisions.slice(0, visible).map((d) => (
                  <tr
                    key={d.id}
                    onClick={() => setOpenId(d.id)}
                    className="cursor-pointer border-b border-border/60 last:border-0 hover:bg-muted/40"
                  >
                    <td className="py-2 pr-4 pl-3 whitespace-nowrap text-muted-foreground">
                      {new Date(d.created_at).toLocaleString()}
                    </td>
                    {!zoneId && <td className="py-2 pr-4 whitespace-nowrap">{zoneNames[d.zone_id] ?? "Unknown"}</td>}
                    <td className="py-2 pr-4">
                      <Badge variant={ACTION_BADGE[d.action]} className="capitalize">
                        {d.action}
                      </Badge>
                    </td>
                    <td className="max-w-md truncate py-2 pr-4 text-muted-foreground" title={d.reasoning}>
                      {d.reasoning}
                    </td>
                    <td className="py-2 pr-4 whitespace-nowrap">
                      {d.action === "none" ? (
                        <span className="text-xs text-muted-foreground">N/A</span>
                      ) : d.field_confirmed_at ? (
                        <span className="text-xs text-green-700 dark:text-green-500">Approved by human</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Pending</span>
                      )}
                    </td>
                  </tr>
                ))}
                {decisions.length > visible && (
                  <tr>
                    <td colSpan={zoneId ? 4 : 5} className="py-2 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setVisible((v) => v + PAGE_SIZE)
                        }}
                        className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                      >
                        Load more history
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
      <DecisionDetailModal
        decision={openDecision}
        zoneName={openDecision ? zoneNames[openDecision.zone_id] ?? "Unknown" : ""}
        onClose={() => setOpenId(null)}
        onConfirm={handleConfirm}
      />
    </Card>
  )
}
