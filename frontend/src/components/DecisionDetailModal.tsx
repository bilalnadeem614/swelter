import { Dialog } from "@base-ui/react/dialog"
import { X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { forecastRangeF, type Action, type Decision } from "@/lib/api"

const ACTION_BADGE: Record<Action, "secondary" | "outline" | "destructive"> = {
  none: "outline",
  alert: "secondary",
  reschedule: "secondary",
  escalate: "destructive",
}

export function DecisionDetailModal({
  decision,
  zoneName,
  onClose,
  onConfirm,
}: {
  decision: Decision | null
  zoneName: string
  onClose: () => void
  onConfirm: (decisionId: string) => void
}) {
  const forecast = forecastRangeF(decision?.reading?.forecast_12h ?? null)

  return (
    <Dialog.Root open={!!decision} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 w-[92vw] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-card p-5 text-card-foreground shadow-lg">
          {decision && (
            <>
              <div className="flex items-start justify-between gap-2">
                <Dialog.Title className="font-heading text-lg font-medium">{zoneName}</Dialog.Title>
                <Dialog.Close className="text-muted-foreground hover:text-foreground">
                  <X className="size-4" />
                </Dialog.Close>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {new Date(decision.created_at).toLocaleString()}
              </p>

              <div className="mt-4 flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Recommended action by agent:</span>
                <Badge variant={ACTION_BADGE[decision.action]} className="capitalize">
                  {decision.action}
                </Badge>
              </div>

              {decision.reading && (
                <p className="mt-2 text-sm">
                  {Math.round(decision.reading.temperature_f)}°F latest reading
                  {forecast ? ` · ${forecast} next 12h` : ""}
                </p>
              )}

              <div className="mt-3">
                <p className="text-sm text-muted-foreground">Reason</p>
                <p className="mt-1 text-sm">{decision.reasoning}</p>
              </div>

              {decision.action !== "none" && (
                <label className="mt-4 flex items-center gap-2 rounded-lg border bg-muted/30 p-3 text-sm">
                  <input
                    type="checkbox"
                    checked={!!decision.field_confirmed_at}
                    disabled={!!decision.field_confirmed_at}
                    onChange={() => !decision.field_confirmed_at && onConfirm(decision.id)}
                    className="size-4"
                  />
                  {decision.field_confirmed_at
                    ? `Action taken — approved by human at ${new Date(decision.field_confirmed_at).toLocaleString()}`
                    : "Mark this action as taken (human approval)"}
                </label>
              )}
            </>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
