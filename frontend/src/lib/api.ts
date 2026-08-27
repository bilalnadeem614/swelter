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
