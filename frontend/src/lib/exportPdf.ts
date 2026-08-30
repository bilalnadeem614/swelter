import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { forecastRangeF, type Decision } from "@/lib/api"

function temperatureLabel(d: Decision): string {
  const temp = d.reading?.temperature_f
  if (temp == null) return "—"
  const range = forecastRangeF(d.reading?.forecast_12h ?? null)
  return range ? `${Math.round(temp)}°F (12h: ${range})` : `${Math.round(temp)}°F`
}

export function exportDecisionLogPdf(decisions: Decision[], zoneNames: Record<string, string> = {}) {
  const doc = new jsPDF()
  const generated = new Date()

  doc.setFontSize(16)
  doc.text("SWELTER — Heat Risk Audit Log", 14, 18)
  doc.setFontSize(9)
  doc.setTextColor(100)
  doc.text(`Generated ${generated.toLocaleString()}`, 14, 24)
  doc.text(
    "Data source: FortyGuard hyperlocal temperature data, ~1h ingestion lag — see README for methodology.",
    14,
    29,
  )

  const actionable = decisions.filter((d) => d.action !== "none")
  const confirmed = actionable.filter((d) => d.field_confirmed_at)
  doc.text(
    `${decisions.length} decisions logged · ${actionable.length} required action · ${confirmed.length} field-confirmed`,
    14,
    34,
  )

  autoTable(doc, {
    startY: 39,
    head: [["Timestamp", "Zone", "Temperature", "Action", "Reasoning", "Field Confirmed"]],
    body: decisions.map((d) => [
      new Date(d.created_at).toLocaleString(),
      zoneNames[d.zone_id] ?? d.zone_id,
      temperatureLabel(d),
      d.action,
      d.reasoning,
      d.field_confirmed_at ? new Date(d.field_confirmed_at).toLocaleString() : "—",
    ]),
    styles: { fontSize: 8, cellWidth: "wrap", overflow: "linebreak" },
    columnStyles: {
      0: { cellWidth: 32 },
      1: { cellWidth: 24 },
      2: { cellWidth: 26 },
      3: { cellWidth: 20 },
      4: { cellWidth: 40 },
      5: { cellWidth: "auto" },
    },
    didDrawPage: () => {
      const pageCount = doc.getNumberOfPages()
      const page = doc.getCurrentPageInfo().pageNumber
      const pageHeight = doc.internal.pageSize.getHeight()
      const pageWidth = doc.internal.pageSize.getWidth()
      doc.setFontSize(8)
      doc.setTextColor(120)
      doc.text("Swelter — autonomous heat-risk monitoring", 14, pageHeight - 10)
      doc.text(`Page ${page} of ${pageCount}`, pageWidth - 14, pageHeight - 10, { align: "right" })
    },
  })

  const date = generated.toISOString().slice(0, 10)
  doc.save(`swelter-audit-log-${date}.pdf`)
}
