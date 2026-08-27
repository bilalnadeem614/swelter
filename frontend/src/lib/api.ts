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

export type Decision = {
  id: string
  zone_id: string
  reading_id: string | null
  action: Action
  reasoning: string
  notified: boolean
  created_at: string
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
