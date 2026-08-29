const BASE_URL = import.meta.env.VITE_API_BASE_URL

export type Action = "none" | "alert" | "reschedule" | "escalate"

export type Zone = {
  id: string
  name: string
  lat: number
  lng: number
  category: string | null
  active: boolean
  created_at: string
}

export type Reading = {
  temperature_f: number
  // raw FortyGuard stats_data, Celsius — see backend/gemini_reasoning.py _forecast_range_f
  forecast_12h: { temperature_stats?: { minimum: number; maximum: number } } | null
  fetched_at: string
}

const cToF = (c: number) => (c * 9) / 5 + 32

// ponytail: mirrors backend/fortyguard_client.py FRESHNESS_LAG (timedelta(hours=48)) — no
// endpoint exposes this value, so it's hardcoded here; keep in sync if the backend constant drifts
export const FRESHNESS_LAG_HOURS = 48

export function tempTrend(current?: number | null, previous?: number | null): "up" | "down" | "flat" {
  if (current == null || previous == null) return "flat"
  const delta = current - previous
  if (Math.abs(delta) < 0.5) return "flat"
  return delta > 0 ? "up" : "down"
}

export function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffMin = Math.round(diffMs / 60000)
  if (diffMin < 1) return "just now"
  if (diffMin < 60) return `${diffMin} min ago`
  const diffHr = Math.round(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  return `${Math.round(diffHr / 24)}d ago`
}

export function forecastRangeF(forecast_12h: Reading["forecast_12h"]): string | null {
  const stats = forecast_12h?.temperature_stats
  if (!stats || stats.minimum == null || stats.maximum == null) return null
  return `${Math.round(cToF(stats.minimum))}-${Math.round(cToF(stats.maximum))}°F`
}

export type Decision = {
  id: string
  zone_id: string
  reading_id: string | null
  action: Action
  reasoning: string
  notified: boolean
  created_at: string
  reading?: Reading | null
  // only populated by /api/decisions/latest, for the trend indicator
  previous_temperature_f?: number | null
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`)
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`)
  return res.json()
}

export const fetchZones = () => get<Zone[]>("/api/zones")
export const fetchDecisions = (zoneId?: string) =>
  get<Decision[]>(zoneId ? `/api/decisions?zone_id=${zoneId}` : "/api/decisions")
export const fetchLatestDecisions = () => get<Decision[]>("/api/decisions/latest")

// hits the frontend's own /api/check-heat proxy (same origin) — never calls the backend
// secret-protected route directly, see decisions.md "Check Now proxy" entry
export async function triggerCheckNow(): Promise<{ processed: string[]; skipped: string[] }> {
  const res = await fetch("/api/check-heat", { method: "POST" })
  if (!res.ok) throw new Error(`check-heat failed: ${res.status}`)
  return res.json()
}

// Stretch A: read-only, no secret needed — public endpoint, hits the backend directly
export async function askAgent(question: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  })
  if (!res.ok) throw new Error(`chat failed: ${res.status}`)
  const data = await res.json()
  return data.answer
}
