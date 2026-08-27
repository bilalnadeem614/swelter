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

  const upstream = await fetch(`${backendUrl}/api/check-heat`, {
    method: "POST",
    headers: { "x-check-heat-secret": secret },
  })
  const body = await upstream.text()
  res.status(upstream.status).setHeader("content-type", "application/json").send(body)
}
