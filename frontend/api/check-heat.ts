// Vercel serverless function (Node runtime, auto-detected from frontend/api/).
// Holds CHECK_HEAT_SECRET server-side so the "Check Now" button never ships it to the client.
export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method not allowed" })
    return
  }

  const backendUrl = process.env.BACKEND_URL
  const secret = process.env.CHECK_HEAT_SECRET
  if (!backendUrl || !secret) {
    res.status(500).json({ error: "proxy misconfigured: BACKEND_URL/CHECK_HEAT_SECRET not set" })
    return
  }

  // zone_id: forwarded through so the frontend can call this once per zone instead of once
  // for all zones — see decisions.md 2026-08-30 for why (shared-budget contention causing
  // partial "skipped" runs)
  const zoneId = typeof req.query?.zone_id === "string" ? req.query.zone_id : undefined
  const upstreamUrl = new URL(`${backendUrl}/api/check-heat`)
  if (zoneId) upstreamUrl.searchParams.set("zone_id", zoneId)

  const upstream = await fetch(upstreamUrl.toString(), {
    method: "POST",
    headers: { "x-check-heat-secret": secret },
  })
  const body = await upstream.text()
  res.status(upstream.status).setHeader("content-type", "application/json").send(body)
}
